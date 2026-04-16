.PHONY: help install generate build watch test test-e2e lint package package-server test-package clean update-grammar dfa update-library web

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	npm install

generate: ## Generate TypeScript parser from ANTLR4 grammar
	npm run generate

build: ## Compile TypeScript and bundle with esbuild
	npm run build

watch: ## Watch mode for development
	npm run watch

test: ## Run unit tests (vitest)
	npm run test

test-e2e: ## Run VS Code E2E tests
	npm run test:e2e

lint: ## Run ESLint
	npm run lint

package: ## Build VSIX for distribution
	npm run package

package-server: ## Build server tarball for use in other extensions
	npm run package:server
	@echo ""
	@echo "✅ Server package created:"
	@ls -lh sysml-v2-lsp-*.tgz
	@echo ""
	@echo "Install in your extension with:"
	@echo "  npm install ./path/to/sysml-v2-lsp-*.tgz"
	@echo "  — or —"
	@echo "  npm install github:daltskin/sysml-v2-lsp"

test-package: package-server ## Test npm package in a simulated consumer project
	@echo "📦 Testing npm package as a consumer..."
	@rm -rf /tmp/sysml-test-pkg
	@mkdir -p /tmp/sysml-test-pkg
	@cd /tmp/sysml-test-pkg && npm init -y > /dev/null 2>&1
	@cd /tmp/sysml-test-pkg && npm install "$$(ls -t $(CURDIR)/sysml-v2-lsp-*.tgz | head -1)" --silent 2>&1
	@cd /tmp/sysml-test-pkg && node -e " \
		const pkg = require('sysml-v2-lsp'); \
		const fs = require('fs'); \
		const { fork } = require('child_process'); \
		let ok = true; \
		for (const [name, p] of Object.entries(pkg)) { \
			const exists = fs.existsSync(p); \
			console.log(exists ? '  ✅' : '  ❌', name, '→', p); \
			if (!exists) ok = false; \
		} \
		if (!ok) { console.log('❌ Missing files'); process.exit(1); } \
		const child = fork(pkg.serverPath, ['--stdio'], { silent: true }); \
		child.on('error', e => { console.log('❌ Fork failed:', e.message); process.exit(1); }); \
		setTimeout(() => { \
			console.log('  ✅ server.js forks and runs (pid', child.pid + ')'); \
			child.kill(); \
			console.log(''); \
			console.log('✅ npm package test passed'); \
			process.exit(0); \
		}, 2000); \
	"
	@rm -rf /tmp/sysml-test-pkg

clean: ## Clean build artifacts
	npm run clean

GRAMMAR_REPO := daltskin/sysml-v2-grammar
GRAMMAR_BRANCH := main
GRAMMAR_BASE_URL := https://raw.githubusercontent.com/$(GRAMMAR_REPO)/$(GRAMMAR_BRANCH)/grammar

update-grammar: ## Pull latest grammar, rebuild parser, and regenerate DFA snapshot
	@echo "📥 Fetching grammar from $(GRAMMAR_REPO)..."
	curl -fsSL $(GRAMMAR_BASE_URL)/SysMLv2Lexer.g4 -o grammar/SysMLv2Lexer.g4
	curl -fsSL $(GRAMMAR_BASE_URL)/SysMLv2Parser.g4 -o grammar/SysMLv2Parser.g4
	@echo "✅ Grammar files updated from $(GRAMMAR_REPO)"
	@echo ""
	@echo "🔧 Rebuilding parser and DFA snapshot..."
	npm run build
	npx tsx scripts/generate-dfa-snapshot.ts
	npm run compile
	@echo "✅ DFA snapshot regenerated"

dfa: build ## Regenerate the DFA snapshot (run after any grammar change)
	npx tsx scripts/generate-dfa-snapshot.ts
	npm run compile
	@echo "✅ DFA snapshot regenerated"

LIBRARY_REPO := Systems-Modeling/SysML-v2-Release
LIBRARY_BRANCH := master
LIBRARY_ARCHIVE_URL := https://github.com/$(LIBRARY_REPO)/archive/refs/heads/$(LIBRARY_BRANCH).tar.gz
LIBRARY_DIR := sysml.library

update-library: ## Pull latest SysML v2 standard library from OMG release repo
	@echo "📥 Fetching SysML v2 standard library from $(LIBRARY_REPO)..."
	@RELEASE_TAG=$$(curl -fsSL https://api.github.com/repos/$(LIBRARY_REPO)/releases/latest 2>/dev/null \
		| grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/') ; \
	COMMIT_SHA=$$(curl -fsSL https://api.github.com/repos/$(LIBRARY_REPO)/commits/$(LIBRARY_BRANCH) 2>/dev/null \
		| grep '"sha"' | head -1 | sed 's/.*"sha": *"\([^"]*\)".*/\1/' | cut -c1-7) ; \
	echo "  Release: $${RELEASE_TAG:-unknown}  ($(LIBRARY_BRANCH) @ $${COMMIT_SHA:-unknown})"
	@rm -rf /tmp/sysml-v2-library-update
	@mkdir -p /tmp/sysml-v2-library-update
	curl -fsSL $(LIBRARY_ARCHIVE_URL) | tar xz -C /tmp/sysml-v2-library-update --strip-components=1 --wildcards '*/$(LIBRARY_DIR)/*'
	@rm -rf $(LIBRARY_DIR)/Domain\ Libraries $(LIBRARY_DIR)/Kernel\ Libraries $(LIBRARY_DIR)/Systems\ Library
	@cp -R /tmp/sysml-v2-library-update/$(LIBRARY_DIR)/* $(LIBRARY_DIR)/
	@rm -rf /tmp/sysml-v2-library-update
	@echo ""
	@echo "📊 Library stats:"
	@echo "  $$(find $(LIBRARY_DIR) -name '*.sysml' | wc -l) .sysml files"
	@echo "  $$(find $(LIBRARY_DIR) -name '*.kerml' | wc -l) .kerml files"
	@echo ""
	@echo "✅ SysML v2 standard library updated from $(LIBRARY_REPO)"

ci: lint build test ## Full CI pipeline

web: build ## Launch the web client (http://localhost:3000)
	@echo "🌐 Starting SysML v2 web client on http://localhost:3000 ..."
	node clients/web/server.mjs
