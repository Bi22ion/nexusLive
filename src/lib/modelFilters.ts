export interface ModelFilter {
  filter?: string;
  value?: string;
  category?: string;
}

export interface StripcashModel {
  id?: string | number;
  username?: string;
  displayName?: string;
  name?: string;
  subject?: string;
  previewUrl?: string;
  avatar?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  viewersCount?: number;
  usersCount?: number;
  age?: number | null;
  ethnicity?: string | null;
  bodyType?: string | null;
  tags?: string[] | null;
  isVr?: boolean | null;
  isMobile?: boolean | null;
  isLovense?: boolean | null;
  isNew?: boolean | null;
  isHd?: boolean | null;
  gender?: string | null;
  country?: string | null;
  status?: string | null;
}

export function mapAgeToRange(value: string): [number, number] | null {
  const v = value.toLowerCase();
  if (v.includes("18")) return [18, 21];
  if (v.includes("22") || v.includes("young")) return [22, 29];
  if (v.includes("milf")) return [30, 39];
  if (v.includes("mature")) return [40, 99];
  return null;
}

export function mapAgeToApiParam(value: string): string | null {
  const v = value.toLowerCase();
  if (v.includes("18")) return "18-19";
  if (v.includes("22") || v.includes("young")) return "20-29";
  if (v.includes("milf")) return "30-39";
  if (v.includes("mature")) return "40+";
  return null;
}

export function mapEthnicityToApi(value: string): string | null {
  const v = value.toLowerCase();
  if (v.includes("asian")) return "asian";
  if (v.includes("ebony") || v.includes("black")) return "ebony";
  if (v.includes("latina") || v.includes("hispanic")) return "latina";
  if (v.includes("white") || v.includes("caucasian")) return "white";
  return null;
}

export function mapBodyTypeToApi(value: string): string | null {
  const v = value.toLowerCase();
  if (v.includes("skinny") || v.includes("petite")) return "skinny";
  if (v.includes("athletic") || v.includes("fit")) return "athletic";
  if (v.includes("curvy")) return "curvy";
  if (v.includes("bbw")) return "bbw";
  return null;
}

const SPECIALS_MAP: Record<string, { apiParams: Record<string, string> }> = {
  ukrainian: { apiParams: { ethnicity: "white", country: "UA" } },
  new: { apiParams: { isNew: "true" } },
  vr: { apiParams: { isVr: "true" } },
  bdsm: { apiParams: { tags: "bdsm" } },
  tickets: { apiParams: { tags: "ticket-show" } },
};

export function getSpecialCategoryFilter(slug: string): Record<string, string> | null {
  const entry = SPECIALS_MAP[slug.toLowerCase()];
  return entry ? entry.apiParams : null;
}

export function getSpecialCategoryLabel(slug: string): string {
  const labels: Record<string, string> = {
    ukrainian: "Ukrainian",
    new: "New Models",
    vr: "VR Cams",
    bdsm: "BDSM",
    tickets: "Ticket Shows",
  };
  return labels[slug.toLowerCase()] || (slug.charAt(0).toUpperCase() + slug.slice(1));
}

export function buildApiFilterParams(filter: ModelFilter): Record<string, string> {
  const params: Record<string, string> = {};

  if (filter.category) {
    const specialParams = getSpecialCategoryFilter(filter.category);
    if (specialParams) {
      Object.assign(params, specialParams);
    }
  }

  if (filter.filter && filter.value) {
    const { filter: fType, value } = filter;

    if (fType === "Age") {
      const ageParam = mapAgeToApiParam(value);
      if (ageParam) params.ageRange = ageParam;
    } else if (fType === "Ethnicity") {
      const eth = mapEthnicityToApi(value);
      if (eth) params.ethnicity = eth;
    } else if (fType === "Body Type") {
      const bt = mapBodyTypeToApi(value);
      if (bt) params.bodyType = bt;
    } else if (fType === "Tags") {
      const tagMap: Record<string, string> = {
        "interactive toy": "lovense",
        mobile: "mobile",
        outdoor: "outdoor",
      };
      const tagKey = tagMap[value.toLowerCase()];
      if (tagKey) {
        if (tagKey === "lovense") params.isLovense = "true";
        else if (tagKey === "mobile") params.isMobile = "true";
        else params.tags = tagKey;
      }
    }
  }

  return params;
}

export function clientFilterModel(model: StripcashModel, filter: ModelFilter): boolean {
  if (!filter.filter && !filter.category) return true;

  if (filter.category) {
    const slug = filter.category.toLowerCase();
    if (slug === "vr" && !model.isVr) return false;
    if (slug === "new" && !model.isNew) return false;
    if (slug === "bdsm") {
      const tags = (model.tags || []).map((t) => t.toLowerCase());
      if (!tags.some((t) => t.includes("bdsm"))) return false;
    }
    if (slug === "tickets") {
      const tags = (model.tags || []).map((t) => t.toLowerCase());
      if (!tags.some((t) => t.includes("ticket"))) return false;
    }
    if (slug === "ukrainian") {
      const country = (model.country || "").toLowerCase();
      const eth = (model.ethnicity || "").toLowerCase();
      if (country !== "ua" && country !== "ukraine" && !eth.includes("white")) {
        return false;
      }
    }
  }

  if (filter.filter && filter.value) {
    const { filter: fType, value } = filter;
    const v = value.toLowerCase();

    if (fType === "Age") {
      const range = mapAgeToRange(value);
      if (range && model.age != null) {
        const age = Number(model.age);
        return age >= range[0] && age <= range[1];
      }
      return true;
    }

    if (fType === "Ethnicity") {
      const eth = (model.ethnicity || "").toLowerCase();
      return eth.includes(v) || eth.includes(mapEthnicityToApi(value) || "");
    }

    if (fType === "Body Type") {
      const bt = (model.bodyType || "").toLowerCase();
      const apiVal = mapBodyTypeToApi(value);
      return bt.includes(v) || (apiVal ? bt.includes(apiVal) : false);
    }

    if (fType === "Tags") {
      const tags = Array.isArray(model.tags) ? model.tags : [];
      if (v.includes("interactive toy")) return !!model.isLovense;
      if (v.includes("mobile")) return !!model.isMobile;
      if (v.includes("outdoor")) {
        return tags.some((t: string) => t.toLowerCase().includes("outdoor"));
      }
      return tags.some((t: string) => t.toLowerCase().includes(v));
    }
  }

  return true;
}
