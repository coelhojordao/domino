/**
 * Espaço reservado para anúncio. Quando a conta do AdSense/AdinPlay for aprovada,
 * o script da rede entra aqui. Nunca mostrar durante a jogada, só no lobby e entre rodadas.
 */
export function AdSlot({ kind }: { kind: 'banner' | 'box' | 'side' }) {
  return (
    <div className={`ad-slot ad-${kind}`} aria-label="Publicidade">
      <span>Publicidade</span>
    </div>
  );
}
