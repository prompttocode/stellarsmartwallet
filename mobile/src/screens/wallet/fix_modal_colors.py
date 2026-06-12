with open('RampScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace("""                  <Ionicons
                    color={
                      isCompleted
                        ? '#168A58'
                        : Number(order.state) === 5
                        ? '#6B7280'
                        : '#C43D45'
                    }
                    name={
                      isCompleted
                        ? 'checkmark'
                        : Number(order.state) === 5
                        ? 'remove'
                        : 'close'
                    }
                    size={25}
                  />""", """                  <Ionicons
                    color={
                      isCompleted
                        ? '#B8FF45'
                        : Number(order.state) === 5
                        ? '#A1B0C8'
                        : '#FF5252'
                    }
                    name={
                      isCompleted
                        ? 'checkmark'
                        : Number(order.state) === 5
                        ? 'remove'
                        : 'close'
                    }
                    size={28}
                  />""")

with open('RampScreen.tsx', 'w') as f:
    f.write(content)
