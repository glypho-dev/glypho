// Build & Deploy

>LR

push:c Push #0af
build:r Build
test:d Pass?
deploy:r Deploy #0a0
fix:r Fix #f44

push>build
build>test
test>deploy yes
test>fix no
fix>push
