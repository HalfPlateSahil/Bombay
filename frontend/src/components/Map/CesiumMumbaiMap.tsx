"use client";

import React, { useEffect, useRef } from "react";
import { TrafficData } from "../../types";

interface CesiumMumbaiMapProps {
  layers: Record<string, boolean>;
  traffic: TrafficData | null;
  gisData: any;
  selectedLocation: { name: string; lat: number; lon: number } | null;
  onMapClick: (lat: number, lon: number) => void;
}

export const CesiumMumbaiMap: React.FC<CesiumMumbaiMapProps> = ({
  layers,
  traffic,
  gisData,
  selectedLocation,
  onMapClick
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const buildingDataSourceRef = useRef<any>(null);
  const trafficDataSourceRef = useRef<any>(null);
  const epicenterEntityRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    // Load Cesium dynamically
    import("cesium").then((Cesium) => {
      if (viewerRef.current) return;

      // Set Cesium default base URL for static workers
      (window as any).CESIUM_BASE_URL = "https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/";

      const viewer = new Cesium.Viewer(containerRef.current!, {
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: true,
        selectionIndicator: true
      });

      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          subdomains: "abcd",
          credit: "CartoDB Dark Matter"
        })
      );

      // Enable atmosphere & lighting
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true;
      }

      // Initial Camera flyTo over Mumbai Central (19.05° N, 72.85° E)
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(72.85, 19.01, 3500),
        orientation: {
          heading: Cesium.Math.toRadians(15.0),
          pitch: Cesium.Math.toRadians(-38.0),
          roll: 0.0
        },
        duration: 2.5
      });

      // Canvas Click Handler for epicenter picking
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          const lon = Cesium.Math.toDegrees(cartographic.longitude);
          onMapClick(lat, lon);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = viewer;
    });

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Update Camera when selectedLocation changes
  useEffect(() => {
    if (!viewerRef.current || !selectedLocation) return;
    import("cesium").then((Cesium) => {
      const viewer = viewerRef.current;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          selectedLocation.lon,
          selectedLocation.lat - 0.015,
          1800
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-35.0),
          roll: 0.0
        },
        duration: 2.0
      });

      // Render 3D Pulsing Epicenter Beacon
      if (epicenterEntityRef.current) {
        viewer.entities.remove(epicenterEntityRef.current);
      }

      epicenterEntityRef.current = viewer.entities.add({
        name: selectedLocation.name,
        position: Cesium.Cartesian3.fromDegrees(selectedLocation.lon, selectedLocation.lat, 20),
        cylinder: {
          length: 180.0,
          topRadius: 40.0,
          bottomRadius: 0.0,
          material: Cesium.Color.CYAN.withAlpha(0.65),
          outline: true,
          outlineColor: Cesium.Color.WHITE
        },
        label: {
          text: selectedLocation.name,
          font: "14px sans-serif",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -25)
        }
      });
    });
  }, [selectedLocation]);

  // Load 3D Buildings GeoJSON Layer into Cesium
  useEffect(() => {
    if (!viewerRef.current || !gisData || !gisData.buildings_3d) return;
    import("cesium").then((Cesium) => {
      const viewer = viewerRef.current;

      if (buildingDataSourceRef.current) {
        viewer.dataSources.remove(buildingDataSourceRef.current);
      }

      if (layers.buildings) {
        Cesium.GeoJsonDataSource.load(gisData.buildings_3d, {
          clampToGround: true
        }).then((dataSource) => {
          buildingDataSourceRef.current = dataSource;
          viewer.dataSources.add(dataSource);

          const entities = dataSource.entities.values;
          for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const height = (entity.properties && entity.properties.height) ? entity.properties.height.getValue() : 35;
            
            if (entity.polygon) {
              (entity.polygon as any).extrudedHeight = height;
              entity.polygon.material = Cesium.Color.fromCssColorString("#00f0ff").withAlpha(0.35) as any;
              entity.polygon.outline = new Cesium.ConstantProperty(true) as any;
              entity.polygon.outlineColor = Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.6) as any;
            }
          }
        });
      }
    });
  }, [gisData, layers.buildings]);

  // Load Traffic Routes into Cesium Viewer
  useEffect(() => {
    if (!viewerRef.current || !traffic || !traffic.roads) return;
    import("cesium").then((Cesium) => {
      const viewer = viewerRef.current;

      if (trafficDataSourceRef.current) {
        viewer.entities.remove(trafficDataSourceRef.current);
      }

      if (layers.traffic) {
        for (const road of traffic.roads) {
          let color = Cesium.Color.GREEN;
          if (road.congestion > 75) color = Cesium.Color.RED;
          else if (road.congestion > 45) color = Cesium.Color.ORANGE;

          const flatCoords: number[] = [];
          for (const c of road.coordinates) {
            flatCoords.push(c[1], c[0], 10);
          }

          viewer.entities.add({
            name: road.name,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights(flatCoords),
              width: 6,
              material: color
            }
          });
        }
      }
    });
  }, [traffic, layers.traffic]);

  return (
    <div className="relative w-full h-full bg-[#080c14] overflow-hidden">
      <link
        rel="stylesheet"
        href="https://cesium.com/downloads/cesiumjs/releases/1.119/Build/Cesium/Widgets/widgets.css"
      />
      <div ref={containerRef} className="w-full h-full z-0" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(8,12,20,0.85)] z-5" />
    </div>
  );
};
