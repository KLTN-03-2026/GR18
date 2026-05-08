package com.restaurant.ai;

import com.restaurant.entity.AiSystemConfig;
import com.restaurant.entity.MenuItem;
import com.restaurant.menu.MenuCategoryRules;
import com.restaurant.repository.AiSystemConfigRepository;
import com.restaurant.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Gợi ý món chỉ từ dữ liệu nội bộ DB + trọng số admin (rating / sales).
 */
@Service
@RequiredArgsConstructor
public class AiMenuRecommendationService {

    private final AiSystemConfigRepository configRepository;
    private final MenuItemRepository menuItemRepository;
    private final AiJsonIds aiJsonIds;

    public List<MenuItem> recommendTop(int limit) {
        return recommendTop(limit, false);
    }

    /** Top món ăn bán chạy (loại trừ đồ uống). */
    public List<MenuItem> recommendTopSellingFood(int limit) {
        List<MenuItem> pool = loadPool(loadConfig(), true);
        if (pool.isEmpty() || limit <= 0) {
            return List.of();
        }
        return pool.stream()
                .sorted(Comparator
                        .comparing((MenuItem m) -> m.getTotalSold() == null ? 0 : m.getTotalSold())
                        .reversed()
                        .thenComparing((MenuItem m) -> m.getAvgRating() != null ? m.getAvgRating().doubleValue() : 0.0,
                                Comparator.reverseOrder()))
                .limit(limit)
                .collect(Collectors.toList());
    }

    /** Top món ăn được đánh giá cao (loại trừ đồ uống). */
    public List<MenuItem> recommendTopRatedFood(int limit) {
        List<MenuItem> pool = loadPool(loadConfig(), true);
        if (pool.isEmpty() || limit <= 0) {
            return List.of();
        }
        return pool.stream()
                .sorted(Comparator
                        .comparing((MenuItem m) -> m.getAvgRating() != null ? m.getAvgRating().doubleValue() : 0.0,
                                Comparator.reverseOrder())
                        .thenComparing((MenuItem m) -> m.getTotalSold() == null ? 0 : m.getTotalSold(),
                                Comparator.reverseOrder()))
                .limit(limit)
                .collect(Collectors.toList());
    }

    /** Món ăn có đánh giá thấp (loại trừ đồ uống). */
    public List<MenuItem> recommendLowRatedFood(int limit) {
        List<MenuItem> pool = loadPool(loadConfig(), true);
        if (pool.isEmpty() || limit <= 0) {
            return List.of();
        }
        return pool.stream()
                .sorted(Comparator
                        .comparing((MenuItem m) -> m.getAvgRating() != null ? m.getAvgRating().doubleValue() : 0.0)
                        .thenComparing((MenuItem m) -> m.getTotalSold() == null ? 0 : m.getTotalSold(),
                                Comparator.reverseOrder()))
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * @param excludeBeverages true: bỏ danh mục đồ uống — dùng khi chat / gợi ý «món ăn».
     */
    public List<MenuItem> recommendTop(int limit, boolean excludeBeverages) {
        AiSystemConfig cfg = loadConfig();
        List<MenuItem> pool = loadPool(cfg, excludeBeverages);
        if (pool.isEmpty()) {
            return List.of();
        }
        double rw = cfg.getRatingWeight() != null ? cfg.getRatingWeight() : 0.65;
        double sw = cfg.getSalesWeight() != null ? cfg.getSalesWeight() : 0.35;
        double sum = rw + sw;
        if (sum <= 0) {
            rw = 0.65;
            sw = 0.35;
            sum = 1;
        }
        final double rwf = rw / sum;
        final double swf = sw / sum;

        int maxSold = pool.stream().mapToInt(m -> m.getTotalSold() != null ? m.getTotalSold() : 0).max().orElse(1);

        List<MenuItem> scored = new ArrayList<>(pool);
        scored.sort(Comparator.comparingDouble((MenuItem m) -> {
            double rating = m.getAvgRating() != null ? m.getAvgRating().doubleValue() : 0;
            int sold = m.getTotalSold() != null ? m.getTotalSold() : 0;
            double normSold = maxSold > 0 ? (double) sold / maxSold : 0;
            return -(rating / 5.0 * rwf + normSold * swf);
        }));

        LinkedHashSet<Long> seen = new LinkedHashSet<>();
        List<MenuItem> out = new ArrayList<>();

        List<Long> pinned = aiJsonIds.parseLongIds(cfg.getPinnedMenuItemIdsJson());
        if (!pinned.isEmpty()) {
            List<MenuItem> pinnedItems = menuItemRepository.findActiveAvailableByIds(pinned);
            Map<Long, MenuItem> byId = pinnedItems.stream().collect(Collectors.toMap(MenuItem::getId, x -> x));
            for (Long pid : pinned) {
                MenuItem mi = byId.get(pid);
                if (mi == null) {
                    continue;
                }
                if (excludeBeverages && mi.getCategory() != null
                        && MenuCategoryRules.isBeverageCategory(mi.getCategory())) {
                    continue;
                }
                if (!seen.add(mi.getId())) {
                    continue;
                }
                out.add(mi);
                if (out.size() >= limit) {
                    return out;
                }
            }
        }

        for (MenuItem m : scored) {
            if (seen.add(m.getId())) {
                out.add(m);
                if (out.size() >= limit) {
                    break;
                }
            }
        }
        return out;
    }

    private List<MenuItem> loadPool(AiSystemConfig cfg, boolean excludeBeverages) {
        List<Long> catIds = aiJsonIds.parseLongIds(cfg.getRestrictCategoryIdsJson());
        if (catIds.isEmpty()) {
            if (excludeBeverages) {
                return menuItemRepository.findAllActiveAvailableFoodOnly();
            }
            return menuItemRepository.findByIsActiveTrueAndIsAvailableTrue();
        }
        List<MenuItem> raw = menuItemRepository.findByCategoryIdInAndIsActiveTrueAndIsAvailableTrue(catIds);
        if (excludeBeverages) {
            return raw.stream()
                    .filter(m -> m.getCategory() == null || !MenuCategoryRules.isBeverageCategory(m.getCategory()))
                    .collect(Collectors.toList());
        }
        return raw;
    }

    @Transactional(readOnly = true)
    public AiSystemConfig loadConfig() {
        return configRepository.findById(AiSystemConfig.SINGLETON_ID)
                .orElseGet(this::defaultConfig);
    }

    private AiSystemConfig defaultConfig() {
        return AiSystemConfig.builder()
                .id(AiSystemConfig.SINGLETON_ID)
                .aiEnabled(true)
                .geminiEnabled(true)
                .pinnedMenuItemIdsJson("[]")
                .restrictCategoryIdsJson("[]")
                .historyLookbackDays(90)
                .ratingWeight(0.65)
                .salesWeight(0.35)
                .geminiTimeoutMs(2800)
                .anonymizeAnalytics(true)
                .build();
    }
}
