import re

with open('AssetDetailScreen.tsx', 'r') as f:
    content = f.read()

# Add style={{ backgroundColor: '#000000' }} to ScrollView
content = content.replace("<ScrollView\n      contentContainerStyle={screenInsetStyle}", "<ScrollView\n      contentContainerStyle={screenInsetStyle}\n      style={{ backgroundColor: '#000000' }}")

# Replace styles colors
content = content.replace("color: '#24495A'", "color: '#FFFFFF'")
content = content.replace("backgroundColor: '#F4F8FA'", "backgroundColor: '#111318'")
content = content.replace("color: '#17233D'", "color: '#FFFFFF'")
content = content.replace("color: '#0F8EA3'", "color: '#B8FF45'")

with open('AssetDetailScreen.tsx', 'w') as f:
    f.write(content)

