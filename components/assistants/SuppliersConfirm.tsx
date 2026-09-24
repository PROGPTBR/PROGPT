'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  MapPinned,
  Search,
  Tag,
  X,
} from 'lucide-react';

import type {
  CnaeAlternative,
  CnaeInfo,
  ClassifyResponse,
  UF,
} from '@/lib/suppliers/types';

import {
  UF_LIST,
} from '@/lib/suppliers/types';

import { CnaeAutocomplete } from './CnaeAutocomplete';

// ============================================================
// TIPOS
// ============================================================

export type SupplierCity = {
  id: number;
  name: string;
  uf: UF;
};

type IbgeCity = {
  id: number;
  nome: string;
};

type Props = {
  classify: ClassifyResponse;

  onBack: () => void;

  onConfirm: (params: {
    cnae: string;
    cnaeName: string;
    ufs: UF[];
    cities: SupplierCity[];
  }) => void;

  isLoading: boolean;
};

// ============================================================
// COMPONENTE
// ============================================================

export function SuppliersConfirm({
  classify,
  onBack,
  onConfirm,
  isLoading,
}: Props) {
  // ==========================================================
  // CNAE
  // ==========================================================

  const [cnae, setCnae] = useState(
    classify.cnaeCode ?? '',
  );

  const [cnaeName, setCnaeName] = useState(
    classify.cnaeName ?? '',
  );

  // ==========================================================
  // ESTADOS
  // ==========================================================

  const [ufs, setUfs] = useState<UF[]>(
    classify.states ?? [],
  );

  // ==========================================================
  // CIDADES
  // ==========================================================

  const [cities, setCities] = useState<
    SupplierCity[]
  >([]);

  const [
    selectedCities,
    setSelectedCities,
  ] = useState<SupplierCity[]>([]);

  const [
    citySearch,
    setCitySearch,
  ] = useState('');

  const [
    citiesLoading,
    setCitiesLoading,
  ] = useState(false);

  const [
    citiesError,
    setCitiesError,
  ] = useState('');

  // ==========================================================
  // CNAE
  // ==========================================================

  function handleSelectCnae(
    info: CnaeInfo,
  ) {
    setCnae(info.code);
    setCnaeName(info.name);
  }

  function handleSelectAlternative(
    alt: CnaeAlternative,
  ) {
    setCnae(alt.code);
    setCnaeName(alt.name);
  }

  // ==========================================================
  // ESTADOS
  // ==========================================================

  function toggleUf(uf: UF) {
    setUfs((prev) => {
      if (prev.includes(uf)) {
        return prev.filter(
          (item) => item !== uf,
        );
      }

      return [...prev, uf];
    });
  }

  function clearUfs() {
    setUfs([]);
    setCities([]);
    setSelectedCities([]);
    setCitySearch('');
    setCitiesError('');
  }

  // ==========================================================
  // CARREGAR CIDADES
  // ==========================================================

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadCities() {
      // Remove cidades pertencentes a estados
      // que foram desmarcados.
      setSelectedCities((prev) =>
        prev.filter((city) =>
          ufs.includes(city.uf),
        ),
      );

      // Nenhum estado selecionado.
      if (ufs.length === 0) {
        setCities([]);
        setCitySearch('');
        setCitiesError('');
        setCitiesLoading(false);
        return;
      }

      try {
        setCitiesLoading(true);
        setCitiesError('');

        const results =
          await Promise.all(
            ufs.map(
              async (
                uf,
              ): Promise<
                SupplierCity[]
              > => {
                const response =
                  await fetch(
                    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
                    {
                      signal:
                        controller.signal,
                    },
                  );

                if (!response.ok) {
                  throw new Error(
                    `Não foi possível carregar as cidades de ${uf}.`,
                  );
                }

                const data =
                  (await response.json()) as IbgeCity[];

                return data.map(
                  (city) => ({
                    id: city.id,
                    name: city.nome,
                    uf,
                  }),
                );
              },
            ),
          );

        const allCities =
          results.flat();

        allCities.sort((a, b) => {
          const nameCompare =
            a.name.localeCompare(
              b.name,
              'pt-BR',
            );

          if (nameCompare !== 0) {
            return nameCompare;
          }

          return a.uf.localeCompare(
            b.uf,
          );
        });

        setCities(allCities);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'AbortError'
        ) {
          return;
        }

        console.error(
          'Erro ao carregar cidades:',
          error,
        );

        setCities([]);

        setCitiesError(
          'Não foi possível carregar as cidades. Tente novamente.',
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setCitiesLoading(false);
        }
      }
    }

    void loadCities();

    return () => {
      controller.abort();
    };
  }, [ufs]);

  // ==========================================================
  // FILTRAR CIDADES
  // ==========================================================

  const filteredCities =
    useMemo(() => {
      const search =
        citySearch
          .trim()
          .toLocaleLowerCase(
            'pt-BR',
          );

      if (!search) {
        return [];
      }

      return cities
        .filter((city) => {
          const cityName =
            city.name.toLocaleLowerCase(
              'pt-BR',
            );

          const uf =
            city.uf.toLocaleLowerCase();

          return (
            cityName.includes(
              search,
            ) ||
            `${cityName} ${uf}`.includes(
              search,
            )
          );
        })
        .slice(0, 50);
    }, [cities, citySearch]);

  // ==========================================================
  // CIDADES
  // ==========================================================

  function isCitySelected(
    city: SupplierCity,
  ) {
    return selectedCities.some(
      (selected) =>
        selected.id === city.id,
    );
  }

  function toggleCity(
    city: SupplierCity,
  ) {
    setSelectedCities((prev) => {
      const exists =
        prev.some(
          (item) =>
            item.id === city.id,
        );

      if (exists) {
        return prev.filter(
          (item) =>
            item.id !== city.id,
        );
      }

      return [...prev, city];
    });
  }

  function removeCity(
    cityId: number,
  ) {
    setSelectedCities((prev) =>
      prev.filter(
        (city) =>
          city.id !== cityId,
      ),
    );
  }

  function clearCities() {
    setSelectedCities([]);
    setCitySearch('');
  }

  // ==========================================================
  // SUBMIT
  // ==========================================================

  function handleSubmit() {
    if (!cnae) {
      return;
    }

    onConfirm({
      cnae,
      cnaeName,
      ufs,
      cities: selectedCities,
    });
  }

  const canSubmit =
    cnae.length > 0 &&
    !isLoading;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6">
      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <div className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />

          Voltar
        </button>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Confirme o que vamos buscar{' '}
          <span className="text-brand">
            .
          </span>
        </h1>

        {classify.rationale && (
          <p className="text-sm text-muted-foreground">
            {classify.rationale}
          </p>
        )}
      </div>

      {/* =====================================================
          CNAE
      ===================================================== */}

      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Tag
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />

          CNAE
        </div>

        {cnae ? (
          <div className="space-y-1.5">
            <div className="font-mono text-sm text-brand">
              {cnae}
            </div>

            <div className="text-base text-foreground">
              {cnaeName}
            </div>

            {classify.confidence >
              0 && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Confiança:{' '}
                {(
                  classify.confidence *
                  100
                ).toFixed(0)}
                %
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            Nenhum CNAE
            selecionado — busque
            abaixo.
          </div>
        )}

        {classify.alternatives
          .length > 0 && (
          <div className="pt-2 border-t border-border space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Outras opções da IA
            </div>

            <div className="flex flex-wrap gap-1.5">
              {classify.alternatives.map(
                (alt) => (
                  <button
                    key={alt.code}
                    type="button"
                    onClick={() =>
                      handleSelectAlternative(
                        alt,
                      )
                    }
                    className={`rounded-full border px-3 h-7 text-xs transition-all duration-200 active:scale-95 ${
                      alt.code ===
                      cnae
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border bg-background hover:bg-accent text-foreground/80'
                    }`}
                    title={
                      alt.name
                    }
                  >
                    <span className="font-mono">
                      {alt.code}
                    </span>

                    <span className="ml-1.5 hidden sm:inline">
                      {alt.name
                        .length >
                      30
                        ? `${alt.name.slice(
                            0,
                            30,
                          )}…`
                        : alt.name}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Buscar outro CNAE
          </div>

          <CnaeAutocomplete
            value={cnae}
            onSelect={
              handleSelectCnae
            }
          />
        </div>
      </div>

      {/* =====================================================
          ESTADOS
      ===================================================== */}

      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MapPin
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />

            Estados
          </div>

          {ufs.length > 0 && (
            <button
              type="button"
              onClick={clearUfs}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
          )}
        </div>

        {/* ESTADOS SELECIONADOS */}

        {ufs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ufs.map((uf) => (
              <button
                key={uf}
                type="button"
                onClick={() =>
                  toggleUf(uf)
                }
                className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/30 px-3 h-7 text-xs font-medium text-brand hover:bg-brand/20 transition-colors"
              >
                {uf}

                <X
                  className="h-3 w-3"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        )}

        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {ufs.length === 0
            ? 'Sem filtro = busca nacional'
            : 'Adicionar/remover'}
        </div>

        {/* LISTA DOS ESTADOS */}

        <div className="flex flex-wrap gap-1.5">
          {UF_LIST.map(
            (uf) => {
              const active =
                ufs.includes(uf);

              return (
                <button
                  key={uf}
                  type="button"
                  onClick={() =>
                    toggleUf(uf)
                  }
                  className={`rounded-md border px-2.5 h-7 text-xs font-medium transition-all duration-150 active:scale-95 ${
                    active
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-background hover:bg-accent text-foreground/70'
                  }`}
                >
                  {uf}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* =====================================================
          CIDADES
      ===================================================== */}

      {ufs.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          {/* CABEÇALHO */}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <MapPinned
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />

              Cidades
            </div>

            {selectedCities.length >
              0 && (
              <button
                type="button"
                onClick={
                  clearCities
                }
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          {/* CIDADES SELECIONADAS */}

          {selectedCities.length >
            0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedCities.map(
                (city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() =>
                      removeCity(
                        city.id,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/30 px-3 h-7 text-xs font-medium text-brand hover:bg-brand/20 transition-colors"
                  >
                    {city.name}

                    <span className="opacity-60">
                      {city.uf}
                    </span>

                    <X
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                  </button>
                ),
              )}
            </div>
          )}

          {/* INFO */}

          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {selectedCities.length ===
            0
              ? ufs.length === 1
                ? `Sem cidade selecionada = todo o estado de ${ufs[0]}`
                : `Sem cidade selecionada = todos os municípios de ${ufs.join(
                    ', ',
                  )}`
              : `${
                  selectedCities.length
                } ${
                  selectedCities.length ===
                  1
                    ? 'cidade selecionada'
                    : 'cidades selecionadas'
                }`}
          </div>

          {/* BUSCA DA CIDADE */}

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <input
              type="text"
              value={citySearch}
              onChange={(event) =>
                setCitySearch(
                  event.target
                    .value,
                )
              }
              placeholder={
                ufs.length === 1
                  ? `Buscar cidade em ${ufs[0]}`
                  : 'Buscar cidade nos estados selecionados'
              }
              disabled={
                citiesLoading
              }
              className="w-full h-11 rounded-xl border border-border bg-background pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/10 disabled:opacity-60"
            />

            {citiesLoading ? (
              <Loader2
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand"
                aria-hidden="true"
              />
            ) : citySearch ? (
              <button
                type="button"
                onClick={() =>
                  setCitySearch(
                    '',
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* CARREGANDO */}

          {citiesLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />

              Carregando cidades...
            </div>
          )}

          {/* ERRO */}

          {citiesError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {citiesError}
            </div>
          )}

          {/* QUANTIDADE CARREGADA */}

          {!citiesLoading &&
            !citiesError &&
            cities.length > 0 &&
            !citySearch && (
              <div className="text-xs text-muted-foreground">
                {cities.length}{' '}
                {cities.length === 1
                  ? 'cidade disponível'
                  : 'cidades disponíveis'}
                . Digite acima para
                localizar uma cidade.
              </div>
            )}

          {/* RESULTADOS */}

          {!citiesLoading &&
            !citiesError &&
            citySearch.trim()
              .length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background p-2">
                {filteredCities.length >
                0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {filteredCities.map(
                      (city) => {
                        const active =
                          isCitySelected(
                            city,
                          );

                        return (
                          <button
                            key={
                              city.id
                            }
                            type="button"
                            onClick={() =>
                              toggleCity(
                                city,
                              )
                            }
                            className={`rounded-md border px-3 min-h-8 text-xs transition-all duration-150 active:scale-95 ${
                              active
                                ? 'border-brand bg-brand/10 text-brand'
                                : 'border-border bg-card hover:bg-accent text-foreground/80'
                            }`}
                          >
                            {
                              city.name
                            }

                            <span className="ml-1.5 opacity-50">
                              {
                                city.uf
                              }
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className="px-3 py-5 text-center text-xs text-muted-foreground">
                    Nenhuma cidade
                    encontrada para "
                    {citySearch}".
                  </div>
                )}
              </div>
            )}
        </div>
      )}

      {/* =====================================================
          BUSCAR
      ===================================================== */}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={
            handleSubmit
          }
          disabled={
            !canSubmit
          }
          className="inline-flex items-center gap-2 rounded-full bg-brand text-black h-11 px-6 text-sm font-medium hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
        >
          {isLoading
            ? 'Buscando…'
            : 'Buscar fornecedores'}

          <ArrowRight
            className="h-4 w-4"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}