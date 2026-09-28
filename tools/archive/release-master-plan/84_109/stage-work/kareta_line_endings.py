from pathlib import Path
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
for rel in ['api/db.php','api/bootstrap.php','config.php']:
    b=(root/rel).read_bytes()
    print(rel, 'bytes='+str(len(b)), 'crlf='+str(b.count(b'\r\n')), 'lf='+str(b.count(b'\n')), 'bare_lf='+str(b.count(b'\n')-b.count(b'\r\n')))
