/**
 * 041 — Catálogo local do seletor de emojis: caracteres Unicode e nomes em
 * português. Não usa imagens nem faz pedidos externos. A pesquisa e a inserção
 * vivem aqui para poderem ser testadas sem DOM.
 */
export const EMOJI_CATEGORIES = [
  { id: "faces", label: "Rostos", icon: "😀" },
  { id: "gestures", label: "Gestos", icon: "👋" },
  { id: "hearts", label: "Corações", icon: "❤️" },
  { id: "party", label: "Celebração", icon: "🎉" },
  { id: "nature", label: "Natureza", icon: "🌸" },
  { id: "food", label: "Comida", icon: "🍕" },
  { id: "objects", label: "Objetos", icon: "💡" },
] as const;

export type EmojiCategory = (typeof EMOJI_CATEGORIES)[number]["id"];
export type Emoji = { value: string; label: string; category: EmojiCategory };

const groups: Record<EmojiCategory, readonly (readonly [string, string])[]> = {
  faces: [
    ["😀", "Sorriso"], ["😃", "Sorriso alegre"], ["😄", "Riso"], ["😁", "Sorriso radiante"],
    ["😆", "Riso com os olhos fechados"], ["😅", "Sorriso com suor"], ["😂", "Riso com lágrimas"],
    ["🤣", "Gargalhada"], ["😊", "Sorriso corado"], ["😉", "Piscadela"], ["😍", "Apaixonado"],
    ["🥰", "Carinho"], ["😘", "Beijo"], ["😗", "Enviar um beijo"], ["😋", "Delicioso"],
    ["😛", "Mostrar a língua"], ["😜", "Piscadela com língua"], ["🤪", "Loucura"],
    ["😎", "Óculos de sol"], ["🤩", "Estrelas nos olhos"], ["🥳", "Rosto festivo"],
    ["🙂", "Sorriso leve"], ["🙃", "Rosto ao contrário"], ["🤗", "Abraço"], ["🤭", "Risadinha"],
    ["🤔", "A pensar"], ["🤫", "Silêncio"], ["😐", "Rosto neutro"], ["😑", "Sem expressão"],
    ["🙄", "Olhos revirados"], ["😏", "Sorriso maroto"], ["😌", "Alívio"], ["😴", "A dormir"],
    ["🥱", "Bocejo"], ["😔", "Triste"], ["😢", "A chorar"], ["😭", "Choro"],
    ["🥺", "Por favor"], ["😮", "Surpresa"], ["😱", "Espanto"], ["😬", "Careta"],
    ["😳", "Vergonha"], ["😤", "Irritado"], ["😡", "Zangado"], ["🤯", "Incrédulo"],
    ["🤒", "Doente"], ["🤕", "Ferido"], ["🤢", "Náusea"], ["🤧", "Espirro"],
    ["😇", "Anjo"], ["🤠", "Cowboy"], ["🤡", "Palhaço"], ["👻", "Fantasma"],
    ["🤖", "Robô"], ["💩", "Cocó"], ["😺", "Gato sorridente"], ["😻", "Gato apaixonado"],
  ],
  gestures: [
    ["👋", "Saudação"], ["🤚", "Mão levantada"], ["✋", "Parar"], ["🖐️", "Mão aberta"],
    ["👌", "OK"], ["🤌", "Dedos unidos"], ["✌️", "Paz"], ["🤞", "Dedos cruzados"],
    ["🤟", "Gosto de ti"], ["🤘", "Rock"], ["🤙", "Liga-me"], ["👈", "Apontar para a esquerda"],
    ["👉", "Apontar para a direita"], ["👆", "Apontar para cima"], ["👇", "Apontar para baixo"],
    ["☝️", "Atenção"], ["👍", "Polegar para cima"], ["👎", "Polegar para baixo"], ["✊", "Punho"],
    ["👊", "Bater punhos"], ["👏", "Aplausos"], ["🙌", "Mãos a celebrar"],
    ["👐", "Mãos abertas"], ["🤲", "Mãos juntas"], ["🤝", "Acordo"],
    ["🙏", "Obrigado"], ["💪", "Força"], ["✍️", "Escrever"], ["👀", "Olhos"], ["🫶", "Mãos em forma de coração"],
  ],
  hearts: [
    ["❤️", "Coração vermelho"], ["🧡", "Coração laranja"], ["💛", "Coração amarelo"],
    ["💚", "Coração verde"], ["💙", "Coração azul"], ["💜", "Coração roxo"],
    ["🖤", "Coração preto"], ["🤍", "Coração branco"], ["🤎", "Coração castanho"],
    ["💖", "Coração brilhante"], ["💕", "Dois corações"], ["💗", "Coração a crescer"],
    ["💓", "Coração a bater"], ["💞", "Corações a girar"], ["💘", "Coração com seta"],
    ["💝", "Coração com laço"], ["💔", "Coração partido"], ["❤️‍🔥", "Coração em chamas"],
    ["❤️‍🩹", "Coração a sarar"], ["💌", "Carta de amor"], ["💋", "Marca de beijo"], ["💯", "Cem pontos"],
  ],
  party: [
    ["🎉", "Festa com confetes"], ["🎊", "Confetes"], ["🎈", "Balão"], ["🎁", "Presente"],
    ["🎀", "Laço"], ["🎂", "Bolo de aniversário"], ["🧁", "Queque decorado"], ["🕯️", "Vela"],
    ["✨", "Brilhos"], ["🌟", "Estrela brilhante"], ["⭐", "Estrela"], ["💫", "Brilho"],
    ["🎆", "Fogo de artifício"], ["🎇", "Faísca"], ["🪅", "Pinhata"], ["🪩", "Bola de espelhos"],
    ["🥂", "Brinde"], ["🍾", "Champanhe"], ["🎵", "Nota musical"], ["🎶", "Música"],
    ["🎤", "Microfone"], ["💃", "Dançarina"], ["🕺", "Dançarino"], ["👑", "Coroa"],
    ["🏆", "Troféu"], ["🏅", "Medalha"], ["🎓", "Graduação"], ["💍", "Anel"],
  ],
  nature: [
    ["🌸", "Flor de cerejeira"], ["🌷", "Tulipa"], ["🌹", "Rosa"], ["🌻", "Girassol"],
    ["💐", "Ramo de flores"], ["🌺", "Flor de hibisco"], ["🌼", "Margarida"], ["🌿", "Erva"],
    ["🍀", "Trevo"], ["🌵", "Cato"], ["🌴", "Palmeira"], ["🌳", "Árvore"],
    ["☀️", "Sol"], ["🌈", "Arco-íris"], ["☁️", "Nuvem"], ["🌧️", "Chuva"],
    ["❄️", "Neve"], ["🔥", "Fogo"], ["💧", "Gota de água"], ["🌙", "Lua"],
    ["🌎", "Mundo"], ["🐶", "Cão"], ["🐱", "Gato"], ["🐰", "Coelho"],
    ["🐻", "Urso"], ["🦄", "Unicórnio"], ["🦋", "Borboleta"], ["🐝", "Abelha"],
    ["🐥", "Pintainho"], ["🐢", "Tartaruga"], ["🐬", "Golfinho"], ["🦖", "Dinossauro"],
  ],
  food: [
    ["🍎", "Maçã"], ["🍊", "Laranja"], ["🍋", "Limão"], ["🍌", "Banana"],
    ["🍉", "Melancia"], ["🍇", "Uvas"], ["🍓", "Morango"], ["🍒", "Cereja"],
    ["🍍", "Ananás"], ["🥑", "Abacate"], ["🌽", "Milho"], ["🌮", "Taco"],
    ["🌯", "Burrito"], ["🍕", "Pizza"], ["🍔", "Hambúrguer"], ["🍟", "Batatas fritas"],
    ["🌭", "Cachorro-quente"], ["🍿", "Pipocas"], ["🍩", "Donut"], ["🍪", "Bolacha"],
    ["🍫", "Chocolate"], ["🍬", "Doce"], ["🍭", "Gelado no pauzinho"], ["🍦", "Gelado"],
    ["☕", "Café"], ["🫖", "Chá"], ["🧃", "Sumo"], ["🥤", "Refrigerante"],
  ],
  objects: [
    ["✅", "Confirmado"], ["✔️", "Correto"], ["❌", "Cancelar"], ["❗", "Importante"],
    ["❓", "Pergunta"], ["⚠️", "Aviso"], ["🔔", "Campainha"], ["📌", "Alfinete"],
    ["📍", "Localização"], ["📅", "Calendário"], ["⏰", "Alarme"], ["⌛", "Espera"],
    ["📦", "Pacote"], ["🛍️", "Compras"], ["🛒", "Carrinho"], ["🚚", "Camião de entregas"],
    ["🚗", "Carro"], ["🏠", "Casa"], ["🏪", "Loja"], ["💡", "Ideia"],
    ["📱", "Telemóvel"], ["☎️", "Telefone"], ["💻", "Computador"], ["📷", "Câmara"],
    ["📝", "Nota"], ["📚", "Livros"], ["✉️", "Envelope"], ["🔑", "Chave"],
    ["🔒", "Cadeado"], ["🔗", "Ligação"], ["🔧", "Chave inglesa"], ["🔨", "Martelo"],
    ["⚽", "Futebol"], ["🏀", "Basquetebol"],
  ],
};

export const EMOJIS: readonly Emoji[] = EMOJI_CATEGORIES.flatMap(({ id }) =>
  groups[id].map(([value, label]) => ({ value, label, category: id }))
);

/** Minúsculas e sem acentos: «coracao» encontra «Coração». */
export function emojiSearchText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-AO");
}

/**
 * O que mostra o seletor: a pesquisa percorre todo o catálogo; sem pesquisa,
 * mostra a categoria escolhida ou todas.
 */
export function filterEmojis(
  search: string,
  category: EmojiCategory | "all"
): readonly Emoji[] {
  const query = emojiSearchText(search.trim());
  if (query) {
    return EMOJIS.filter(
      (emoji) => emojiSearchText(emoji.label).includes(query) || emoji.value === search.trim()
    );
  }
  return category === "all" ? EMOJIS : EMOJIS.filter((emoji) => emoji.category === category);
}

/** Insere no cursor ou substitui a seleção, devolvendo a nova posição do cursor. */
export function insertAtSelection(
  text: string,
  start: number,
  end: number,
  emoji: string
): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.max(from, Math.min(Math.max(start, end), text.length));
  return {
    text: text.slice(0, from) + emoji + text.slice(to),
    caret: from + emoji.length,
  };
}
