$2y$10$T0ZZBfQViS59THNWWiK.VuTgOMHtZqM4iXAm8YTRqsuGeYNtwpUj.
UPDATE users SET password_hash = '$2y$10$T0ZZBfQViS59THNWWiK.VuTgOMHtZqM4iXAm8YTRqsuGeYNtwpUj.' WHERE email = 'admin@erp.local';
SELECT * FROM user_roles;
INSERT INTO user_roles (user_id, role_id) VALUES ('bcd68bbc-17be-48a7-a891-19c5d517286e', '2f4c408e-9b66-4f47-9434-0fe3b57128ce');