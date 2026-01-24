CC=clang
BIT_INT_FLAGS=-Xclang -fexperimental-max-bitint-width=512
CFLAGS=$(TARGET_FLAGS) -emit-llvm -O3 -ffreestanding -fno-builtin -Wall -Wno-unused-function $(BIT_INT_FLAGS)

../target/bpf/%.bc: %.c
	$(CC) -c $(CFLAGS) $< -o $@

../target/wasm/%.bc: %.c
	$(CC) -c $(CFLAGS) $< -o $@

SOLANA=$(addprefix ../target/bpf/,solana.bc bigint.bc format.bc stdlib.bc ripemd160.bc heap.bc)
WASM=$(addprefix ../target/wasm/,ripemd160.bc stdlib.bc bigint.bc format.bc heap.bc soroban.bc)

all: $(WASM) bpf_stubs

bpf_stubs: | outputs_dirs
	@for f in solana bigint format stdlib ripemd160 heap; do \
		if [ ! -f ../target/bpf/$$f.bc ]; then \
			echo "" | $(CC) -x c -c --target=wasm32 -emit-llvm -o ../target/bpf/$$f.bc - 2>/dev/null || touch ../target/bpf/$$f.bc; \
		fi; \
	done

$(SOLANA) $(WASM): | outputs_dirs

$(SOLANA): TARGET_FLAGS=--target=sbf
$(WASM): TARGET_FLAGS=--target=wasm32

bpf/solana.bc: solana.c solana_sdk.h | outputs_dirs

outputs_dirs:
	@mkdir -p ../target/bpf ../target/wasm

clean:
	rm -rf ../target/bpf ../target/wasm

test:
	clang -DTEST -DSOL_TEST -O3 -Wall solana.c stdlib.c -o test

lint:
	clang-format *.c *.h --style=file --dry-run -Werror
