// Entity-Relationship Diagram
// Database schema for a simple e-commerce system

>LR

// Entities (using rectangles)
user:r """User
---
id: PK
email
name
created_at"""

order:r """Order
---
id: PK
user_id: FK
status
total
created_at"""

product:r """Product
---
id: PK
name
price
stock"""

order_item:r """OrderItem
---
id: PK
order_id: FK
product_id: FK
quantity
price"""

category:r """Category
---
id: PK
name
parent_id: FK"""

review:r """Review
---
id: PK
user_id: FK
product_id: FK
rating
comment"""

// Relationships
user>order "1:N"
order>order_item "1:N"
product>order_item "1:N"
category>product "1:N"
category>category "self-ref"
user>review "1:N"
product>review "1:N"

// Groups
@core{user order product}
@details{order_item review}
@taxonomy{category}
