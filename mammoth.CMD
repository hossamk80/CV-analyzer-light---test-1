@SETLOCAL
@IF NOT DEFINED NODE_PATH (
  @SET "NODE_PATH=E:\CV-analyzer-light - test 1\node_modules\.pnpm\mammoth@1.12.0\node_modules\mammoth\node_modules;E:\CV-analyzer-light - test 1\node_modules\.pnpm\mammoth@1.12.0\node_modules;E:\CV-analyzer-light - test 1\node_modules\.pnpm\node_modules"
) ELSE (
  @SET "NODE_PATH=E:\CV-analyzer-light - test 1\node_modules\.pnpm\mammoth@1.12.0\node_modules\mammoth\node_modules;E:\CV-analyzer-light - test 1\node_modules\.pnpm\mammoth@1.12.0\node_modules;E:\CV-analyzer-light - test 1\node_modules\.pnpm\node_modules;%NODE_PATH%"
)
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\mammoth\bin\mammoth" %*
) ELSE (
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\..\mammoth\bin\mammoth" %*
)
