'use client';

import { useEffect, useState, type SVGProps } from 'react';
import styles from './atualizacoes.module.css';

type IconName = 'book' | 'check' | 'close' | 'external' | 'grid' | 'search';

const iconPaths: Record<IconName, string> = {
  search: 'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  book: 'M12 5v15M3 4l9 1 9-1v15l-9 1-9-1z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
  external: 'M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7',
};

function Icon({
  name = 'grid',
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name?: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

const sampleImage =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="380" viewBox="0 0 1100 380"><rect width="1100" height="380" fill="#0c1422"/><rect x="125" y="45" width="850" height="290" rx="12" fill="#121c2b" stroke="#29374b"/><text x="160" y="88" fill="#e8eef6" font-family="Arial" font-size="20">Meus assistentes</text><text x="160" y="116" fill="#94a3b8" font-family="Arial" font-size="13">Seus favoritos, reunidos em um só lugar.</text><rect x="160" y="145" width="370" height="144" rx="8" fill="#0d1726" stroke="#29374b"/><rect x="550" y="145" width="390" height="144" rx="8" fill="#0d1726" stroke="#29374b"/><text x="183" y="183" fill="#12b7d4" font-family="Arial" font-size="20">✧</text><text x="183" y="219" fill="#e8eef6" font-family="Arial" font-size="17">Análise de propostas</text><text x="183" y="248" fill="#94a3b8" font-family="Arial" font-size="13">Compare condições e apoie sua decisão.</text><text x="575" y="183" fill="#12b7d4" font-family="Arial" font-size="20">✧</text><text x="575" y="219" fill="#e8eef6" font-family="Arial" font-size="17">Negociação com fornecedores</text><text x="575" y="248" fill="#94a3b8" font-family="Arial" font-size="13">Prepare sua próxima negociação.</text><text x="493" y="182" fill="#12b7d4" font-family="Arial" font-size="23">♡</text><text x="900" y="182" fill="#12b7d4" font-family="Arial" font-size="23">♡</text></svg>`,
  );

type UpdateType = 'Novo recurso' | 'Melhoria' | 'Correção';

type Update = {
  id: string;
  date: string;
  week: string;
  month: string;
  type: UpdateType;
  title: string;
  text: string;
  bullets: string[];
  image?: string;
  alt?: string;
  caption?: string;
};

const updates: Update[] = [

  {
    id: 'favoritos',
    date: '30 OUT 2026',
    week: '26 a 30 de outubro',
    month: '10',
    type: 'Novo recurso',
    title: 'Encontre seus assistentes com mais facilidade',
    text: 'Agora você pode buscar assistentes diretamente no menu lateral da área de chat. Abra Assistentes e digite o nome do assistente que deseja encontrar para acessá-lo mais rapidamente.',
    bullets: [
      'Salve um assistente pelo ícone de coração.',
      'Volte aos seus favoritos sempre que precisar.',
    ],
    image: sampleImage,
    alt: 'Exemplo ilustrativo da lista de assistentes favoritos',
    caption: 'Assistentes favoritos • exemplo ilustrativo',
  }
];

const filters: Array<'Todas' | UpdateType> = [
  'Todas',
  'Novo recurso',
  'Melhoria',
  'Correção',
];

const filterLabels = {
  Todas: 'Todas',
  'Novo recurso': 'Novos recursos',
  Melhoria: 'Melhorias',
  Correção: 'Correções',
};

export default function UpdatesPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]>('Todas');
  const [image, setImage] = useState<Update | null>(null);
  const month = '10';

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImage(null);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = image ? 'hidden' : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [image]);

  const normalizedQuery = query.toLocaleLowerCase('pt-BR');
  const items = updates.filter(
    (update) =>
      (filter === 'Todas' || update.type === filter) &&
      update.month === month &&
      `${update.title} ${update.text} ${update.type}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedQuery),
  );

  return (
    <div className={styles.app}>
      <div className={styles.mainShell}>
        <header className={styles.topbar}>
          <a
            className={styles.headerLogo}
            href="#atualizacoes"
            aria-label="PROGPT — Atualizações"
          >
            <img
              src="/atualizacoes/progpt-logo.png"
              alt="PROGPT"
              width="241"
              height="57"
            />
          </a>
          <span className={styles.topInfo}>
            <span className={styles.smallDot} /> Novidades do sistema
          </span>
        </header>

        <main id="atualizacoes" className={styles.content}>
          <div className={styles.pageHeading}>
            <div>
              <div className={styles.eyebrow}>PROGPT EM EVOLUÇÃO</div>
              <h1>Atualizações do sistema</h1>
            </div>
            <span className={styles.weekly}>Atualizações semanais</span>
          </div>

          <section className={styles.toolbar} aria-label="Filtrar atualizações">
            <label className={styles.search}>
              <Icon name="search" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar atualização"
                aria-label="Buscar atualização"
              />
              {query && (
                <button
                  className={styles.iconButton}
                  aria-label="Limpar busca"
                  onClick={() => setQuery('')}
                  type="button"
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </label>
            <span className={styles.monthLabel}>Outubro de 2026</span>
          </section>

          <div className={styles.filters} aria-label="Tipo de atualização">
            {filters.map((item) => (
              <button
                key={item}
                aria-pressed={filter === item}
                className={filter === item ? styles.active : undefined}
                onClick={() => setFilter(item)}
                type="button"
              >
                {filterLabels[item]}
              </button>
            ))}
            <span className={styles.resultCount} aria-live="polite">
              {items.length} {items.length === 1 ? 'publicação' : 'publicações'}
            </span>
          </div>

          <div className={styles.updates}>
            {items.map((update, index) => (
              <article className={styles.update} key={update.id}>
                <div className={styles.dateColumn}>
                  <div className={styles.timelineDot} />
                  <time>{update.date}</time>
                  <span>
                    Semana de
                    <br />
                    {update.week}
                  </span>
                  {index === 0 && filter === 'Todas' && !query && (
                    <span className={styles.latest}>Mais recente</span>
                  )}
                </div>
                <div className={styles.updateContent}>
                  <span
                    className={`${styles.badge} ${
                      update.type === 'Novo recurso'
                        ? styles.new
                        : update.type === 'Melhoria'
                          ? styles.improvement
                          : styles.fix
                    }`}
                  >
                    {update.type === 'Correção' && <Icon name="check" size={12} />}{' '}
                    {update.type}
                  </span>
                  <h2>{update.title}</h2>
                  <p>{update.text}</p>
                  <ul>
                    {update.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  {update.image && (
                    <figure>
                      <button
                        className={styles.imageButton}
                        onClick={() => setImage(update)}
                        aria-label={`Ampliar imagem: ${update.title}`}
                        type="button"
                      >
                        <img src={update.image} alt={update.alt ?? ''} />
                        <span className={styles.expand}>
                          <Icon name="external" size={14} /> Ampliar imagem
                        </span>
                      </button>
                      <figcaption>{update.caption}</figcaption>
                    </figure>
                  )}
                </div>
              </article>
            ))}
          </div>

          {!items.length && (
            <div className={styles.empty}>
              <Icon name="search" size={25} />
              <h2>Nenhuma atualização encontrada</h2>
              <p>Tente outro termo ou selecione um período diferente.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setFilter('Todas');
                }}
                type="button"
              >
                Limpar filtros
              </button>
            </div>
          )}

          <footer className={styles.footer}>
            <span>Você está em dia com as atualizações deste período.</span>
            <span>PROGPT · Feito para simplificar.</span>
          </footer>
        </main>
      </div>

      {image && (
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label={image.title}
          onClick={() => setImage(null)}
        >
          <button
            autoFocus
            className={`${styles.modalClose} ${styles.iconButton}`}
            aria-label="Fechar imagem"
            onClick={() => setImage(null)}
            type="button"
          >
            <Icon name="close" size={24} />
          </button>
          <div onClick={(event) => event.stopPropagation()}>
            <img src={image.image} alt={image.alt ?? ''} />
            <p>{image.caption}</p>
            <small>Pressione Esc ou clique fora da imagem para fechar.</small>
          </div>
        </div>
      )}
    </div>
  );
}
