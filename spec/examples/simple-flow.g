// Simple Flow

>LR

start:c Start #0af
process:r "Do Thing"
check:d OK?
done:p Done #0a0

start>process
process>check
check>done yes
check>process no
