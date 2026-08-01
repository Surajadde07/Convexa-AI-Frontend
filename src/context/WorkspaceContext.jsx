import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { getUser, isAuthenticated, setActiveWorkspaceId } from "../services/api";

const WorkspaceContext = createContext();

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  const isFetchingRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  const getSlugFromPathname = useCallback(() => {
    const match = location.pathname.match(/^\/w\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const isPublicPath = useCallback((pathname) => {
    if (["/", "/login", "/register", "/signup", "/no-workspace"].includes(pathname)) {
      return true;
    }
    if (pathname.startsWith("/invite/")) {
      return true;
    }
    return false;
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    if (!isAuthenticated()) {
      return [];
    }
    try {
      const res = await api.get("/api/workspaces");
      const list = res.data || [];
      setWorkspaces(list);
      return list;
    } catch (err) {
      console.error("Failed to fetch workspaces list:", err);
      setError(err);
      setWorkspaces([]);
      throw err;
    }
  }, []);

  const fetchCurrentWorkspaceDetails = useCallback(async (workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    try {
      const res = await api.get("/api/workspaces/current");
      
      const rawUser = localStorage.getItem("convexa_user");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const company = res.data.company;
        const sub = res.data.subscription;
        
        const mergedUser = {
          ...u,
          role: res.data.role,
          companyId: company.id,
          companyName: company.name,
          companySlug: company.slug,
          companyLogo: company.logoUrl,
          website: company.website,
          industry: company.industry,
          companySize: company.companySize,
          brandPrimaryColor: company.branding?.primaryColor,
          brandSecondaryColor: company.branding?.secondaryColor,
          subscriptionPlan: sub?.plan,
          subscriptionStatus: sub?.status,
          seatLimit: sub?.seatLimit,
          currentSeatCount: sub?.currentSeatCount,
          noWorkspace: false
        };
        localStorage.setItem("convexa_user", JSON.stringify(mergedUser));
      }
      
      setCurrentWorkspace(res.data);
      return res.data;
    } catch (err) {
      console.error("Failed to fetch current workspace details:", err);
      throw err;
    }
  }, []);

  // Unified atomic sync for workspace list, active workspace resolution, and details
  useEffect(() => {
    if (!isAuthenticated()) {
      if (initialized || workspaces.length > 0 || currentWorkspace !== null) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setActiveWorkspaceId(null);
        setInitialized(false);
        setLoading(false);
      }
      return;
    }

    if (isPublicPath(location.pathname)) {
      // Do not initiate workspace sync or URL rewrites on public paths (including /invite/:token)
      return;
    }

    const syncWorkspace = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setLoading(true);

      try {
        let list = workspaces;
        if (list.length === 0) {
          const res = await api.get("/api/workspaces");
          list = res.data || [];
          setWorkspaces(list);
        }

        if (!list || list.length === 0) {
          setInitialized(true);
          setLoading(false);
          if (location.pathname !== "/no-workspace") {
            navigate("/no-workspace", { replace: true });
          }
          return;
        }

        const urlSlug = getSlugFromPathname();
        const activeWs = (urlSlug && list.find((w) => w.slug === urlSlug)) || list[0];

        if (!currentWorkspace || currentWorkspace.company?.id !== activeWs.id) {
          try {
            await fetchCurrentWorkspaceDetails(activeWs.id);
          } catch (err) {
            console.error("Failed to fetch workspace details, using fallback:", err);
            setCurrentWorkspace({
              company: {
                id: activeWs.id,
                name: activeWs.name,
                slug: activeWs.slug,
                logoUrl: activeWs.logoUrl
              },
              subscription: { plan: "BUSINESS", status: "TRIALING", seatLimit: 25, currentSeatCount: 1 },
              role: "OWNER"
            });
          }
        }

        setInitialized(true);

        // Auto-redirect flat routes (like /calls/337) to /w/:companySlug/calls/337
        if (!urlSlug) {
          const subPath = (location.pathname === "/" || location.pathname === "" || location.pathname === "/dashboard") ? "/dashboard" : location.pathname;
          navigate(`/w/${activeWs.slug}${subPath}`, { replace: true });
        }
      } catch (err) {
        console.error("Error during workspace synchronization:", err);
        setInitialized(true);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    syncWorkspace();
  }, [location.pathname, isAuthenticated(), isPublicPath]);

  const value = {
    workspaces,
    currentWorkspace,
    initialized,
    loading: loading || (!initialized && isAuthenticated() && !isPublicPath(location.pathname)),
    error,
    refreshWorkspaces: async () => {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setInitialized(false);
      const list = await fetchWorkspaces();
      if (list && list.length > 0) {
        await fetchCurrentWorkspaceDetails(list[0].id);
        setInitialized(true);
      }
    },
    switchWorkspace: (slug) => {
      navigate(`/w/${slug}/dashboard`);
    }
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
