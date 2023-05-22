cd ../..
cargo build --release
cp target/release/typst*.exe addons/vscode/out/
cp target/release/typst* addons/vscode/out/
cd addons/vscode
mv README.md ../README.md.bak
echo "# gitee.com/xsro/typst-lsp 修改版" >> README.md
date >> README.md
cat ../README.md.bak >> README.md
npm run package
rm out/*.*
ver=`cat package.json | grep version | cut -d '"' -f 4`
case "$OSTYPE" in
  solaris*) platform="SOLARIS" ;;
  darwin*)  platform="OSX" ;; 
  linux*)   platform="LINUX" ;;
  bsd*)     platform="BSD" ;;
  msys*)    platform="WINDOWS" ;;
  *)        platform="unknown: $OSTYPE" ;;
esac

today=`date +"%Y%m%d-%H"`
hash=`git rev-parse --short HEAD`
mv typst-lsp-$ver.vsix typst-lsp-${ver}_${today}_$platform-$(arch)_${hash}.vsix
rm README.md
mv  ../README.md.bak README.md