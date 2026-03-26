>LR

webapp:r "Web App"
mobile:r "Mobile App"
api:r "API Server"
worker:r "Worker"
gateway:r Gateway
db:c Database

webapp>gateway
mobile>gateway
gateway>api
api>worker
api>db
worker>db

@system "System" {
  @frontend "Frontend" {
    webapp
    mobile
  }
  @backend "Backend" {
    api
    worker
  }
  gateway
}
