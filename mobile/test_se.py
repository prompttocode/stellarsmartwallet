import urllib.request
import json

url = "https://api.stellar.expert/explorer/public/asset?limit=5"
req = urllib.request.Request(url, headers={'Accept': 'application/json'})
response = urllib.request.urlopen(req)
data = json.loads(response.read())

for item in data['_embedded']['records']:
    print(item['asset'], "price7d length:", len(item.get('price7d', [])))
