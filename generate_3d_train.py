import trimesh
import numpy as np

def create_local_train_car(offset_x=0):
    # Main Body (White)
    body = trimesh.creation.box(extents=(3.2, 3.8, 22.0))
    body.visual.vertex_colors = [240, 240, 240, 255] # White-ish gray
    
    # Roof (Dark Gray)
    roof = trimesh.creation.box(extents=(3.0, 0.5, 21.8))
    roof.apply_translation([0, 1.9 + 0.25, 0])
    roof.visual.vertex_colors = [80, 80, 80, 255]
    
    # Pantograph Base (Reddish) - only on some cars, but let's add a small one
    panto = trimesh.creation.box(extents=(1.5, 0.3, 1.5))
    panto.apply_translation([0, 2.15 + 0.15, 0])
    panto.visual.vertex_colors = [180, 50, 50, 255]
    
    # Purple/Magenta Side Stripes
    stripe_left = trimesh.creation.box(extents=(3.25, 0.8, 22.0))
    stripe_left.apply_translation([0, -0.5, 0])
    stripe_left.visual.vertex_colors = [180, 30, 180, 255] # Purple
    
    # Windows (Dark Blue/Black)
    windows = trimesh.creation.box(extents=(3.22, 1.2, 21.0))
    windows.apply_translation([0, 0.8, 0])
    windows.visual.vertex_colors = [30, 30, 45, 255]
    
    car = trimesh.util.concatenate([body, roof, panto, stripe_left, windows])
    
    # Translate the entire car to the offset
    car.apply_translation([offset_x, 0, 0])
    return car

# 3-car local train (EMU)
car1 = create_local_train_car(23.0)  # Front
car2 = create_local_train_car(0.0)   # Middle
car3 = create_local_train_car(-23.0) # Rear

train = trimesh.util.concatenate([car1, car2, car3])

# Center it so the pivot is roughly in the middle, sitting on the ground
train.apply_translation([0, 1.9, 0])

# Export to GLB in the frontend public directory
train.export('frontend/public/mumbai_local.glb')
print("mumbai_local.glb created successfully in frontend/public")
