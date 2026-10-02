REPORT zcustomer_count.

DATA customer_count TYPE i.

SELECT COUNT( * ) FROM zopenabap_customer INTO customer_count.
WRITE / customer_count.