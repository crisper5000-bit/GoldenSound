import { Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { RequireAuth, RequireRole } from "./components/common/Guards";
import { AdminPage } from "./pages/AdminPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaylistsPage } from "./pages/PlaylistsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { SellerPage } from "./pages/SellerPage";
import { TrackDetailsPage } from "./pages/TrackDetailsPage";

export default function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/tracks/:trackId" element={<TrackDetailsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        <Route
          path="/library"
          element={
            <RequireAuth>
              <LibraryPage />
            </RequireAuth>
          }
        />

        <Route
          path="/playlists"
          element={
            <RequireAuth>
              <PlaylistsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/checkout"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />

        <Route
          path="/seller"
          element={
            <RequireRole roles={["SELLER"]}>
              <SellerPage />
            </RequireRole>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireRole roles={["ADMIN"]}>
              <AdminPage />
            </RequireRole>
          }
        />
      </Routes>
    </MainLayout>
  );
}
