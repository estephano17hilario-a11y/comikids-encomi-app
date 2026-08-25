import re

disposition = 'inline; filename="Ticket_Shalom_92495242.pdf"'
match = re.search(r'_(\d{8,12})\.pdf', disposition)
if match:
    print("Matched as DNI:", match.group(1)) # 92495242 !!
    client_dni = "78005117"
    if client_dni != match.group(1):
        print("Bug reproduced: rejected valid voucher!")
