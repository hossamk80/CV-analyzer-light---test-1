@SETLOCAL
@IF NOT DEFINED NODE_PATH (
  @SET "NODE_PATH=E:\CV-analyzer-light\node_modules\.pnpm\vite@6.4.3_@types+node@22.2_39ae0627b10a49c980e38000da261da9\node_modules\vite\node_modules;E:\CV-analyzer-light\node_modules\.pnpm\vite@6.4.3_@types+node@22.2_39ae0627b10a49c980e38000da261da9\node_modules;E:\CV-analyzer-light\node_modules\.pnpm\node_modules"
) ELSE (
  @SET "NODE_PATH=E:\CV-analyzer-light\node_modules\.pnpm\vite@6.4.3_@types+node@22.2_39ae0627b10a49c980e38000da261da9\node_modules\vite\node_modules;E:\CV-analyzer-light\node_modules\.pnpm\vite@6.4.3_@types+node@22.2_39ae0627b10a49c980e38000da261da9\node_modules;E:\CV-analyzer-light\node_modules\.pnpm\node_modules;%NODE_PATH%"
)
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\..\bin\vite.js" %*
) ELSE (
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\..\..\bin\vite.js" %*
)
