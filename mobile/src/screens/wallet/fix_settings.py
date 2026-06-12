with open('SettingsScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace("color: '#171A1F'", "color: '#FFFFFF'")
content = content.replace("backgroundColor: '#171A1F'", "backgroundColor: '#1E222B'")

with open('SettingsScreen.tsx', 'w') as f:
    f.write(content)
