points = [
    {"name": "USA", "lat": 37.09, "lon": -95.71, "svg_x": 215, "svg_y": 375}, # USA mainland start center in SVG is around 215, not 143
    {"name": "India", "lat": 20.59, "lon": 78.96, "svg_x": 595, "svg_y": 470},
    {"name": "Australia", "lat": -25.27, "lon": 133.77, "svg_x": 712, "svg_y": 609},
    {"name": "UK", "lat": 55.37, "lon": -3.43, "svg_x": 416, "svg_y": 367}
]

# Let's solve svg_x = A * lon + B
# Using USA and India:
# 215 = A * -95.71 + B
# 595 = A * 78.96 + B
# A = (595 - 215) / (78.96 - -95.71) = 380 / 174.67 = 2.1755
# B = 595 - 2.1755 * 78.96 = 595 - 171.78 = 423.22

# Let's solve svg_y = C * lat + D
# Using India and Australia:
# 470 = C * 20.59 + D
# 609 = C * -25.27 + D
# C = (470 - 609) / (20.59 - -25.27) = -139 / 45.86 = -3.031
# D = 470 - -3.031 * 20.59 = 470 + 62.4 = 532.4

print("Verifying fitted projection:")
for p in points:
    px = 2.1755 * p["lon"] + 423.22
    py = -3.031 * p["lat"] + 532.4
    print(f"{p['name']}:")
    print(f"  X: actual={p['svg_x']}, predicted={px:.2f} (diff={p['svg_x']-px:.2f})")
    print(f"  Y: actual={p['svg_y']}, predicted={py:.2f} (diff={p['svg_y']-py:.2f})")
