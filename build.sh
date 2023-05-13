cargo build --release
cp target/release/typst*.exe addons/vscode/out/
cp target/release/typst* addons/vscode/out/
cd addons/vscode
mv README.md ../README.md.bak
echo "# gitee.com/xsro/typst-lsp 修改版\n" >> README.md
date >> README.md
echo ``` >>README.md
git status >>README.md
echo ``` >>README.md
cat ../README.md.bak >> README.md
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
rm README.md
mv  ../README.md.bak README.md