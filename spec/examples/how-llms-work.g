// How Large Language Models Work
// From raw text to generated response
>TB

// ── INPUT LAYER ──────────────────────────────────
raw:p "Raw Text" #f4a
tokenizer:h Tokenizer #f4a
tokens:r """Token IDs
[7592, 318, 257,
 3499, 1110]""" #fa5

// ── EMBEDDING ────────────────────────────────────
embed:r """Embedding
Lookup""" #fc0
pos_enc:o """Positional
Encoding""" #fd0
vectors:r """Token Vectors
d=4096""" #fe3

// ── TRANSFORMER BLOCKS ───────────────────────────
attn:d """Self-
Attention""" #6cf
norm1:r LayerNorm #8df
ffn:r """Feed-Forward
Network""" #48f
norm2:r LayerNorm #8df
residual:c + #aef

// ── REPEAT ───────────────────────────────────────
repeat:h """×96 Layers
(GPT-4 scale)""" #c8f

// ── OUTPUT ───────────────────────────────────────
final_norm:r "Final LayerNorm" #f8a
unembed:r """Unembedding
→ Logits""" #f6a
softmax:o Softmax #f55
sample:d """Sample
Next Token""" #f33
output:p "Generated Text" #e22

// ── EDGES ────────────────────────────────────────
raw>tokenizer
tokenizer>tokens "encode"
tokens>embed
embed>pos_enc "add"
pos_enc>vectors

vectors>attn
attn>norm1
norm1>residual
vectors>residual "skip connection"
residual>ffn
ffn>norm2

norm2=repeat "stack"
repeat=final_norm

final_norm>unembed
unembed>softmax "probability distribution"
softmax>sample "top-p / temperature"
sample~output "decode"

// ── FEEDBACK LOOP ────────────────────────────────
output~tokens "autoregressive"

// ── GROUPS ───────────────────────────────────────
@input "Input Processing" {raw tokenizer tokens}
@embedding "Embedding" {embed pos_enc vectors}
@transformer "Transformer Block" {attn norm1 ffn norm2 residual}
@decoding "Output Decoding" {final_norm unembed softmax sample output}

// ── STYLES ───────────────────────────────────────
$:h{fill:#1a1a2e stroke:#fff stroke-width:2}
$:c{fill:#1a1a2e stroke:#aef stroke-width:2}
$:d{stroke-width:2}
