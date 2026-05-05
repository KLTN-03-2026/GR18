-- Hibernate map Integer -> JDBC INTEGER; cột TINYINT khiến ddl-auto=validate lỗi.
ALTER TABLE reviews
    MODIFY COLUMN rating INT NOT NULL;
