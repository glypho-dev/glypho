// Edge styles: mixed chains and groups

>LR

src:c Source #f44336
parse:r Parse
validate:d Valid?
transform:r Transform
error:r Error #d32f2f
out:p Output #4caf50

@pipeline{parse validate transform}

src>parse #1565c0
parse>validate #1565c0
validate>transform yes #2e7d32
validate~error no #d32f2f
transform=out "done" #7b1fa2
error~src "retry" #e65100
