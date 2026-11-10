import styles from './atualizacoes.module.css';

export default function LoadingUpdates() {
  return (
    <div className={styles.app}>
      <div className={styles.loading} role="status" aria-live="polite">
        <span className={styles.loadingSpinner} />
        Carregando atualizações…
      </div>
    </div>
  );
}
