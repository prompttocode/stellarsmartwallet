import re
with open('RampScreen.tsx', 'r') as f:
    content = f.read()

# Replace any remaining standalone `completed` with `isCompleted` inside the JSX blocks.
content = re.sub(r'(\s+)completed(\s+\?|\n\s+\?)', r'\1isCompleted\2', content)

# Fix the modal colors
content = re.sub(r"color=\{\s+isCompleted\s+\?\s+'#168A58'\s+:\s+Number\(order\.state\) === 5\s+\?\s+'#6B7280'\s+:\s+'#C43D45'\s+\}", "color={isCompleted ? '#B8FF45' : Number(order.state) === 5 ? '#A1B0C8' : '#FF5252'}", content)

with open('RampScreen.tsx', 'w') as f:
    f.write(content)
