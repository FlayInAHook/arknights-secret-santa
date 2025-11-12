import { Global } from "@emotion/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PatternBackground from "./components/custom/PatternBackground.tsx";
import { Provider } from "./components/ui/provider.tsx";
import { AdminPage } from "./pages/AdminPage.tsx";
import { ParticipantPage } from "./pages/ParticipantPage.tsx";
import { RegisterPage } from "./pages/RegisterPage.tsx";

export function App() {
  return (
    <Provider forcedTheme="dark">
      <PatternBackground pattern='isometric' textAlign="center" justifyContent={'center'} fontSize="xl" w="100vw" h="100vh" overflowX={"hidden"}>
      <>
        <Global
          styles={`
            @font-face {
              font-family: "Bender";
              src: local("Bender"), url("https://fonts.cdnfonts.com/s/18143/Jovanny Lemonad - Bender-Bold.woff") format("woff");
              font-style: normal;
              font-weight: 700;
            }

            html, body {
              font-family: "Bender", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            }

            body {
              margin: 0;
              min-height: 100vh;
            }

            #root {
              min-height: 100vh;
            }
          `}
        />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/register" replace />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/p/:token" element={<ParticipantPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/register" replace />} />
          </Routes>
        </BrowserRouter>
      </>
      </PatternBackground>
    </Provider>
  );
}

export default App;
