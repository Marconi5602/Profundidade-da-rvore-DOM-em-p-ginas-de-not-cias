# Análise estatística e gráfico a partir de resultados.csv
# Uso: pip install pandas scipy matplotlib && python analisar.py resultados.csv
import sys
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

df = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "resultados.csv")
carga = df[df.fase == "carga"]

# QP1 – estatísticas descritivas (Tabela 2)
cols = {"profMax": "M1 prof. máxima", "profMediaFolhas": "M2 prof. média folhas",
        "total": "M3 total elementos", "maxFilhos": "M4 máx. filhos"}
desc = carga[list(cols)].describe(percentiles=[.25, .5, .75, .9]).T.rename(index=cols)
print("\n== Tabela 2 ==\n", desc[["min", "25%", "50%", "75%", "90%", "max"]].round(1))
print(f"\n% páginas (perfil×página) com profMax > 32: {(carga.profMax > 32).mean()*100:.1f}%")

# QP2 – inicial × matéria (Mann-Whitney, por perfil) (Tabela 3)
print("\n== QP2 ==")
for perfil, g in carga.groupby("perfil"):
    a = g[g.tipo == "inicial"].profMax; b = g[g.tipo == "materia"].profMax
    if len(a) and len(b):
        u, p = stats.mannwhitneyu(a, b, alternative="two-sided")
        print(f"{perfil}: mediana inicial={a.median()} matéria={b.median()} U={u:.1f} p={p:.4f}")

# QP3 – desktop × móvel (Wilcoxon pareado)
print("\n== QP3 ==")
w = carga.pivot_table(index="url", columns="perfil", values="profMax").dropna()
if len(w) > 1 and "desktop" in w and "movel" in w:
    s, p = stats.wilcoxon(w["desktop"], w["movel"])
    print(f"mediana desktop={w['desktop'].median()} móvel={w['movel'].median()} W={s:.1f} p={p:.4f}")

# QP4 – carga × rolagem (Wilcoxon pareado)
print("\n== QP4 ==")
r = df.pivot_table(index=["url", "perfil"], columns="fase", values=["profMax", "total"]).dropna()
for m in ("profMax", "total"):
    if len(r) > 1:
        s, p = stats.wilcoxon(r[(m, "carga")], r[(m, "rolagem")])
        print(f"{m}: carga={r[(m,'carga')].median()} rolagem={r[(m,'rolagem')].median()} W={s:.1f} p={p:.4f}")

# QP5 – Spearman profundidade × total
print("\n== QP5 ==")
rho, p = stats.spearmanr(carga.profMax, carga.total)
print(f"rho={rho:.3f} p={p:.4f}")

# Figura 1
fig, ax = plt.subplots(figsize=(5, 3))
carga.boxplot(column="profMax", by="tipo", ax=ax)
ax.axhline(32, ls="--", c="gray"); ax.set_title(""); fig.suptitle("")
ax.set_xlabel("Tipo de página"); ax.set_ylabel("Profundidade máxima")
fig.tight_layout(); fig.savefig("figura1.png", dpi=200)
print("\nfigura1.png gerada")
