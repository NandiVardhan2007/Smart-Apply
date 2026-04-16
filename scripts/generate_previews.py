from PIL import Image, ImageDraw, ImageFont
import os

dest_dir = r"d:\SMARTAPPLY\Backend\app\static\previews\resumes"
os.makedirs(dest_dir, exist_ok=True)

previews = {
    "executive_gold.jpg": ("#FFD700", "Executive Gold", "Premium & Corporate"),
    "modern_premium.jpg": ("#2196F3", "Modern Premium", "Clean & Professional"),
    "creative_premium.jpg": ("#E91E63", "Creative Premium", "Modern & Vibrant"),
    "structured_standard.jpg": ("#4CAF50", "Structured Std", "Reliable & Clean"),
    "minimalist_sleek.jpg": ("#9E9E9E", "Minimalist Sleek", "Thin & Elegant")
}

for filename, (color, title, subtitle) in previews.items():
    # Create a 300x400 "Resume" looking image
    img = Image.new('RGB', (300, 400), color='#FFFFFF')
    draw = ImageDraw.Draw(img)
    
    # Add a colored header line
    draw.rectangle([0, 0, 300, 80], fill=color)
    
    # Add some "text lines" placeholders
    for i in range(120, 350, 20):
        draw.line([30, i, 270, i], fill="#E0E0E0", width=8)
    
    # Add title
    draw.text((150, 40), title, fill="white", anchor="mm")
    draw.text((150, 60), subtitle, fill="white", anchor="mm", font_size=12)
    
    img.save(os.path.join(dest_dir, filename))
    print(f"Generated {filename}")
