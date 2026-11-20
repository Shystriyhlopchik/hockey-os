import { Partner } from '../../components/partner-showcase/partner';

export const HOME_PARTNERS: readonly Partner[] = [
  {
    id: 'yadrinmoloko',
    name: 'Ядринмолоко',
    headline: 'Большие традиции. Близкие люди.',
    description:
      'История предприятия начинается в 1931 году. Знакомый бренд из Ядрина — в команде партнёров Чебоксарской хоккейной лиги.',
    highlight: '1931',
    highlightLabel: 'начало истории предприятия',
    logo: '/partners/yadrinmoloko.png',
    logoWidth: 880,
    logoHeight: 243,
    link: { href: 'https://yamilk.ru/', label: 'Познакомиться с брендом' },
  },
  {
    id: 'vurnary',
    name: 'Вурнарский мясокомбинат',
    headline: 'Традиции, которые объединяют.',
    description:
      'Предприятие ведёт историю с 1957 года. Уважение к своему делу объединяет людей и в производстве, и в спорте.',
    highlight: '1957',
    highlightLabel: 'год образования мясокомбината',
    logo: '/partners/vurnary.png',
    logoWidth: 862,
    logoHeight: 300,
    link: {
      href: 'https://www.nbchr.ru/agro/index.php?reg=%D0%92%D1%83%D1%80%D0%BD%D0%B0%D1%80%D1%81%D0%BA%D0%B8%D0%B9+%D1%80%D0%B0%D0%B9%D0%BE%D0%BD',
      label: 'История предприятия',
    },
  },
  {
    id: 'mediagid',
    name: 'Медиагид',
    headline: 'У каждой игры есть своя история.',
    description:
      'Прямые трансляции и видеопроизводство. Хоккейные эмоции продолжаются и за пределами трибун.',
    highlight: 'Прямой эфир',
    highlightLabel: 'трансляции и видеопроизводство',
    logo: '/partners/mediagid.png',
    logoWidth: 425,
    logoHeight: 300,
  },
  {
    id: 'sportup',
    name: 'SportUP.su',
    headline: 'Спорт становится ближе.',
    description:
      'Новости, фотографии и истории спортивной жизни Чувашии. Внимание к спорту начинается с людей, которые о нём рассказывают.',
    highlight: 'В центре игры',
    highlightLabel: 'новости спорта Чувашии',
    logo: '/partners/sportup.png',
    logoWidth: 880,
    logoHeight: 199,
    link: { href: 'https://sportup.su/', label: 'Читать о спорте' },
  },
  {
    id: 'morgaushi',
    name: 'Моргаушское яйцо',
    headline: 'Свои бренды. Своя команда.',
    description:
      'Знакомый знак — часть повседневной жизни. Теперь он становится и частью истории нашей лиги. Вместе поддерживаем любовь к хоккею.',
    highlight: 'Рядом с лигой',
    highlightLabel: 'в команде партнёров ЧХЛ',
    logo: '/partners/morgaushi.png',
    logoWidth: 880,
    logoHeight: 232,
  },
  {
    id: 'avtoradio',
    name: 'Авторадио · Чебоксары',
    headline: 'Эмоции, которые слышно.',
    description:
      'Музыка, голоса и настроение города. У нашей игры есть место и за пределами ледовой арены.',
    highlight: '104.2 FM',
    highlightLabel: 'Авторадио · Чебоксары',
    logo: '/partners/avtoradio.png',
    logoWidth: 369,
    logoHeight: 300,
  },
];
