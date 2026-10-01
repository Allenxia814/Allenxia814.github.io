<script lang="ts">
 export let src: string | null = null;
 export let title = '';
 export let eager = false;
 let failed = false;
 $: if (src) failed = false;
</script>
<div class="cover">
 {#if src && !failed}<img {src} alt={`${title} 专辑封面`} loading={eager ? 'eager' : 'lazy'} referrerpolicy="no-referrer" on:error={() => failed = true} />
 {:else}<div class="fallback" aria-label="暂无专辑封面"><span>♫</span><small>封面暂未收录</small></div>{/if}
</div>
<style>
 .cover{aspect-ratio:1;overflow:hidden;border-radius:14px;background:var(--btn-regular-bg);width:100%}img{width:100%;height:100%;object-fit:cover}.fallback{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 20% 20%,color-mix(in srgb,var(--primary) 18%,transparent),transparent 70%)}span{font-size:3.5rem;color:var(--primary)}small{font-size:.75rem;opacity:.5;margin-top:10px}
</style>
