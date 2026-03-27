// Morning Routine

>LR

wake:c "Wake Up"
coffee:r "Make Coffee"
ready:d "Running Late?"
rush:r "Skip Breakfast"
eat:r "Eat Breakfast"
go:p "Head Out"

wake>coffee
coffee>ready
ready>rush yes
ready>eat no
rush>go
eat>go
