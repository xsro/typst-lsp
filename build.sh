cargo build --release
cp target/release/typst*.exe addons/vscode/out/
cp target/release/typst* addons/vscode/out/
cd addons/vscode
npm run package
rm out/*.*
ver="0.4.1"
case "$OSTYPE" in
  solaris*) platform="SOLARIS" ;;
  darwin*)  platform="OSX" ;; 
  linux*)   platform="LINUX" ;;
  bsd*)     platform="BSD" ;;
  msys*)    platform="WINDOWS" ;;
  *)        platform="unknown: $OSTYPE" ;;
esac
mv typst-lsp-$ver.vsix typst-lsp-${ver}_$platform-$(arch).vsix