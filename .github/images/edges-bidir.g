// Edge styles: bidirectional and undirected

>TB

client:h Client #1565c0
server:r Server
db:c DB #e65100
cache:o Cache #7b1fa2

client<>server "request/response" #1565c0
server>db "query" #e65100
db~server "results" #f9a825
server=cache "sync" #7b1fa2
cache--db "linked" #ec407a
client~cache "fallback" #78909c
