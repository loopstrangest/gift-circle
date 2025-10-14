const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
}
