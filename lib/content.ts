export const PALETTES = {
  cobalt: { label: "Графит" },
  copper: { label: "Медь" },
  forest: { label: "Хвоя" },
} as const;

export type Palette = keyof typeof PALETTES;
export const isPalette = (value: unknown): value is Palette =>
  typeof value === "string" && Object.hasOwn(PALETTES, value);

export const TEXT_GROUPS = [
  {
    label: "Бренд и о нас",
    fields: [
      ["brandTagline", "Слоган", "Новая жизнь вашей техники.", 100],
      ["aboutTitle", "Заголовок о нас", "Хорошая техника.", 80],
      ["aboutAccent", "Продолжение заголовка", "История продолжается.", 80],
      ["aboutDescription", "О бренде", "Оборот — это движение вперёд. Ваш смартфон может стать полезным кому-то ещё, а у вас появится возможность выбрать следующий.", 600],
      ["aboutDetail", "Чем помогаем", "Помогаем продать устройство, разобраться с ремонтом и найти телефон с историей. Выберите, что нужно сейчас.", 600],
    ],
  },
  {
    label: "Первый экран",
    fields: [
      ["heroLabel", "Строка над заголовком", "Смартфоны с продолжением", 90],
      ["heroTitle", "Заголовок", "Новая жизнь", 65],
      ["heroAccent", "Строка цветом", "вашей техники.", 65],
      ["heroDescription", "Описание", "Купим ваш смартфон, поможем выбрать другой или вернём к жизни привычный. ОБОРОТ — место, где техника продолжает работать на вас.", 360],
      ["sellAction", "Кнопка скупки", "Продать смартфон", 36],
      ["catalogAction", "Кнопка каталога", "Выбрать смартфон", 36],
      ["navSell", "Меню — скупка", "Скупка", 22],
      ["navCatalog", "Меню — каталог", "Каталог", 22],
      ["navRepair", "Меню — ремонт", "Ремонт", 22],
      ["navContact", "Меню — контакты", "Контакты", 22],
    ],
  },
  {
    label: "Каталог",
    fields: [
      ["catalogTitle", "Заголовок каталога", "Следующий — ваш.", 65],
      ["catalogDescription", "Описание каталога", "Смартфоны с историей и новым будущим. Посмотрите состояние и характеристики, а подробности обсудим в удобном мессенджере.", 240],
      ["productAction", "Кнопка в карточке", "Уточнить наличие", 42],
    ],
  },
  {
    label: "Ремонт",
    fields: [
      ["repairTitle", "Заголовок ремонта", "Привычный смартфон. Снова в деле.", 90],
      ["repairDescription", "Описание ремонта", "Разбился экран, быстро садится батарея или пропала зарядка? Расскажите, что случилось. Обсудим диагностику, а стоимость и сроки согласуем до ремонта.", 480],
      ["repairPhone", "Кнопка телефона", "Показать номер мастера", 45],
    ],
  },
  {
    label: "Скупка",
    fields: [
      ["sellTitle", "Заголовок скупки", "Ваш смартфон ещё многое может.", 90],
      ["sellDescription", "Описание скупки", "Передайте смартфон в хорошие руки и освободите место для нового. Укажите модель и состояние — обсудим оценку и удобную встречу.", 360],
      ["sellStepOne", "Шаг 1", "Укажите модель и состояние устройства.", 140],
      ["sellStepTwo", "Шаг 2", "Свяжитесь с нами и договоритесь об осмотре.", 140],
      ["sellStepThree", "Шаг 3", "Согласуйте цену после проверки техники.", 140],
      ["estimateTitle", "Заголовок формы", "Описание для оценки", 70],
      ["estimateAction", "Кнопка формы", "Подготовить описание", 42],
    ],
  },
  {
    label: "Вопросы и контакты",
    fields: [
      ["faqTitle", "Заголовок блока вопросов", "Частые вопросы", 65],
      ["contactTitle", "Заголовок контактов", "Давайте на связи.", 75],
      ["contactDescription", "Описание контактов", "Выберите удобный способ связи, чтобы обсудить скупку, покупку или ремонт.", 320],
      ["contactPhone", "Кнопка телефона в контактах", "Показать номер", 45],
      ["location", "Адрес или город", "", 200],
      ["hours", "График работы", "", 150],
    ],
  },
] as const;

const textFields = TEXT_GROUPS.flatMap((group) => [...group.fields]);
export type TextKey = (typeof textFields)[number][0];
export type SiteText = Record<TextKey, string>;
const defaultText = Object.fromEntries(
  textFields.map(([key, , value]) => [key, value]),
) as SiteText;

export const CHANNELS = {
  telegram: { label: "Telegram", example: "https://t.me/username" },
  whatsapp: { label: "WhatsApp", example: "https://wa.me/message/…" },
  max: { label: "MAX", example: "https://max.ru/…" },
  vk: { label: "ВКонтакте", example: "https://vk.me/username" },
} as const;

export type Channel = keyof typeof CHANNELS;
export const channelKeys = Object.keys(CHANNELS) as Channel[];
export const isChannel = (value: unknown): value is Channel =>
  typeof value === "string" && Object.hasOwn(CHANNELS, value);

export type Contacts = Record<Channel | "phone", string>;
export type Faq = { question: string; answer: string };
export type SiteSettings = {
  palette: Palette;
  text: SiteText;
  contacts: Contacts;
  faq: Faq[];
};

export type PublicSettings = Pick<SiteSettings, "text" | "faq" | "palette"> & {
  hasPhone: boolean;
  channels: { id: Channel; protected: boolean }[];
};

export const DEFAULT_SETTINGS: SiteSettings = {
  palette: "cobalt",
  text: defaultText,
  contacts: { phone: "", telegram: "", whatsapp: "", max: "", vk: "" },
  faq: [
    { question: "Как продать устройство?", answer: "Подготовьте описание на сайте или напишите нам напрямую. Укажите модель, состояние и комплектацию. Окончательную цену согласуем после осмотра." },
    { question: "Как купить товар из каталога?", answer: "Откройте карточку и свяжитесь с нами, чтобы подтвердить наличие и договориться об осмотре. Оплата на сайте не требуется." },
    { question: "Как узнать стоимость ремонта?", answer: "Сообщите мастеру модель устройства и признаки неисправности. Стоимость и сроки ремонта можно обсудить после диагностики." },
  ],
};

export const CATEGORIES = ["Смартфоны", "Ноутбуки", "Консоли", "Аудио", "Планшеты", "Другая техника"] as const;
export type Category = (typeof CATEGORIES)[number];
export const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);

export type Product = {
  id: string;
  title: string;
  category: Category;
  spec: string;
  condition: string;
  description: string;
  price: number;
  published: boolean;
  demo: boolean;
  photoKey: string | null;
  photoUrl: string | null;
  revision: number;
};

type Sample = Omit<Product, "published" | "demo" | "photoKey" | "photoUrl" | "revision">;
const SAMPLES: Sample[] = [
  {
    id: "sample-iphone", title: "Apple iPhone 13", category: "Смартфоны",
    spec: "128 ГБ · Зелёный", condition: "Хорошее состояние", price: 32900,
    description: "Пример карточки. Небольшие следы использования на корпусе. В комплекте устройство и кабель.",
  },
  {
    id: "sample-macbook", title: "MacBook Air M1", category: "Ноутбуки",
    spec: "8 / 256 ГБ · Space Gray", condition: "Отличное состояние", price: 54900,
    description: "Пример карточки. Аккуратный корпус, зарядное устройство в комплекте. Состояние аккумулятора можно уточнить при осмотре.",
  },
  {
    id: "sample-ps5", title: "Sony PlayStation 5", category: "Консоли",
    spec: "825 ГБ · С дисководом", condition: "Хорошее состояние", price: 39900,
    description: "Пример карточки. Консоль, контроллер, кабель HDMI и кабель питания.",
  },
  {
    id: "sample-sony", title: "Sony WH-1000XM4", category: "Аудио",
    spec: "Беспроводные · Чёрные", condition: "Отличное состояние", price: 16900,
    description: "Пример карточки. Полноразмерные наушники, чехол и кабель в комплекте.",
  },
];

export function samplePhoto(id: string) {
  return SAMPLES.some((sample) => sample.id === id) ? "/assets/" + id + ".webp" : null;
}

export const SAMPLE_PRODUCTS: Product[] = SAMPLES.map((sample) => ({
  ...sample,
  published: true,
  demo: true,
  photoKey: null,
  photoUrl: samplePhoto(sample.id),
  revision: 1,
}));

export const formatPrice = (price: number) => new Intl.NumberFormat("ru-RU").format(price) + " ₽";

// Upgrade untouched starter copy while preserving owner edits.
export const LEGACY_TEXT: Partial<SiteText> = {
  "heroLabel": "Скупка, продажа и ремонт техники",
  "heroTitle": "Техника снова",
  "heroAccent": "в обороте.",
  "heroDescription": "Выкупаем смартфоны, ноутбуки и другую электронику. Поможем найти устройство на замену или починить то, которым вы уже пользуетесь.",
  "sellAction": "Оценить технику",
  "catalogAction": "Смотреть каталог",
  "catalogTitle": "Техника в продаже",
  "catalogDescription": "Посмотрите характеристики и состояние. Наличие и встречу можно обсудить напрямую.",
  "repairTitle": "Отремонтируем вашу технику",
  "repairDescription": "Телефон не заряжается, ноутбук не включается или разбился экран? Напишите мастеру, укажите модель и опишите, что произошло. Он подскажет, как привезти устройство на диагностику.",
  "sellTitle": "Хотите продать технику?",
  "sellDescription": "Расскажите о модели, состоянии и комплектации. Обсудим цену и договоримся об осмотре.",
  "contactTitle": "Обсудим вашу технику?"
};
