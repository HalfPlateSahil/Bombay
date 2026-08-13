import math

def get_train_polygon(lon, lat, heading, length=60.0, width=3.2):
    # meters to degrees
    lat_m = 111320.0
    lon_m = 111320.0 * math.cos(math.radians(lat))
    
    # half dimensions
    hl = length / 2.0
    hw = width / 2.0
    
    rad_H = math.radians(heading)
    # Forward vector (North/East)
    fx = math.sin(rad_H)
    fy = math.cos(rad_H)
    
    # Right vector
    rx = math.cos(rad_H) # sin(H+90)
    ry = -math.sin(rad_H) # cos(H+90)
    
    # 4 corners (front-left, front-right, back-right, back-left)
    # Front-left: center + forward*hl - right*hw
    corners = [
        (lon + (fx*hl - rx*hw)/lon_m, lat + (fy*hl - ry*hw)/lat_m),
        (lon + (fx*hl + rx*hw)/lon_m, lat + (fy*hl + ry*hw)/lat_m),
        (lon + (-fx*hl + rx*hw)/lon_m, lat + (-fy*hl + ry*hw)/lat_m),
        (lon + (-fx*hl - rx*hw)/lon_m, lat + (-fy*hl - ry*hw)/lat_m)
    ]
    # close polygon
    corners.append(corners[0])
    
    return {"type": "Polygon", "coordinates": [corners]}

print(get_train_polygon(72.8, 19.0, 45))
