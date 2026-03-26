// Mind Map: Project Planning
// Uses undirected edges (--) for mind map style connections

>TB

// Central topic
project:c "Project Planning" #f0f

// Main branches
scope:p Scope #faa
time:p Timeline #afa
team:p Team #aaf
risk:p Risks #ffa

// Scope sub-branches
features:r Features
mvp:r MVP
backlog:r Backlog

// Timeline sub-branches
phase1:r "Phase 1"
phase2:r "Phase 2"
milestones:r Milestones

// Team sub-branches
dev:r Developers
design:r Design
qa:r QA

// Risk sub-branches
technical:r Technical
resource:r Resource
schedule:r Schedule

// Main connections (undirected)
project--scope
project--time
project--team
project--risk

// Scope details
scope--features
scope--mvp
scope--backlog

// Timeline details
time--phase1
time--phase2
time--milestones

// Team details
team--dev
team--design
team--qa

// Risk details
risk--technical
risk--resource
risk--schedule

// Groups
@planning{scope time}
@people{team}
@concerns{risk}
