import re
with open('modernStyles.ts', 'r') as f:
    content = f.read()

content = content.replace('''  signOutText: {
    color: '#D84C5F',
    fontSize: 15,
    fontWeight: '800',
  },
  explorerButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  explorerText: {
    color: '#B8FF45',
    fontSize: 13,
    fontWeight: '900',
  },
    fontSize: 16,
    fontWeight: '900',
  },''', '''  signOutText: {
    color: '#D84C5F',
    fontSize: 16,
    fontWeight: '900',
  },
  explorerButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  explorerText: {
    color: '#B8FF45',
    fontSize: 13,
    fontWeight: '900',
  },''')

with open('modernStyles.ts', 'w') as f:
    f.write(content)
