// Idea to Ship

>LR

idea:c Idea #f90
plan:r Plan
build:r Build
test:d Ready?
ship:p Ship #0af

@work{plan build test}

idea>plan
plan>build
build>test
test>ship yes
test>plan no
