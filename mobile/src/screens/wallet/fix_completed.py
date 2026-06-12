with open('RampScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace('!completed', '!isCompleted')
content = content.replace('completed ?', 'isCompleted ?')

with open('RampScreen.tsx', 'w') as f:
    f.write(content)
