from secrets import randbits
from hashlib import sha256

# Base58 encoding for testnet
base58_alphabet = b'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

def b58encodeFromBytes(x):
    old_len = len(x)
    x = x.lstrip(b'\0')
    new_len = len(x)
    acc = int.from_bytes(x, byteorder='big')
    result = b58encodeFromInt(acc, default_one=False)
    return base58_alphabet[0:1] * (old_len - new_len) + result

def b58encodeFromInt(x, default_one=True):
    if not x and default_one:
        return base58_alphabet[0:1]
    base = len(base58_alphabet)
    string = b''
    while x:
        x, remainder = divmod(x, base)
        string = base58_alphabet[remainder:remainder+1] + string
    return string

def int_to_hex_zfill(x):
    return hex(x)[2:].zfill(64).upper()

def generate_testnet_private_key():
    # Generate a random 256-bit private key
    private_key_int = int(randbits(256))
    
    # Ensure it's in valid range (1 to n-1 where n is curve order)
    curve_order = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    if private_key_int >= curve_order:
        private_key_int = private_key_int % (curve_order - 1) + 1
    
    # Convert to hex
    private_key_hex = int_to_hex_zfill(private_key_int)
    
    # Create testnet WIF (prefix 0xef for testnet)
    private_key_hex_px = 'ef' + private_key_hex
    
    # Add checksum
    x = sha256(bytes.fromhex(private_key_hex_px)).hexdigest()
    x = sha256(bytes.fromhex(x)).hexdigest()
    checksum = x[:8]
    private_key_hex_px_cs = private_key_hex_px + checksum
    
    # Encode to WIF
    private_key_WIF = b58encodeFromBytes(bytes.fromhex(private_key_hex_px_cs)).decode("utf-8")
    
    return {
        'private_key_int': private_key_int,
        'private_key_hex': private_key_hex,
        'private_key_wif': private_key_WIF
    }

if __name__ == "__main__":
    print("Bitcoin Testnet Private Key\n")
    
    key_data = generate_testnet_private_key()
    
    print(f"Private key (integer): {key_data['private_key_int']}")
    print(f"Private key (hex): {key_data['private_key_hex']}")
    print(f"Private key (testnet WIF): {key_data['private_key_wif']}")