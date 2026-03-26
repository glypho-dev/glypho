// Authentication Flow
// A typical login flowchart with decision points

>LR

// Entry point
start:c Start #0f0

// Main process nodes
login:r "Enter Credentials"
validate:d "Valid?"
mfa:d "MFA Enabled?"
verify:r "Enter MFA Code"
mfa_check:d "Code Valid?"

// Outcomes
dashboard:r Dashboard #0af
retry:r "Show Error"
lockout:r "Account Locked" #f00

// Main flow
start>login
login>validate

// Validation branch
validate>mfa yes
validate>retry no

// MFA branch
mfa>dashboard no
mfa>verify yes

// MFA verification
verify>mfa_check
mfa_check>dashboard yes
mfa_check>retry no

// Retry loops back
retry>login retry

// Groups
@auth{login validate mfa verify mfa_check}
@outcomes{dashboard retry lockout}
