package com.restaurant.repository;

import com.restaurant.entity.MenuItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {

    @Query("SELECT m FROM MenuItem m JOIN FETCH m.category")
    List<MenuItem> findAllWithCategory();

    @Query("""
    SELECT m FROM MenuItem m 
    JOIN FETCH m.category 
    WHERE m.category.id = :categoryId
""")
    List<MenuItem> findByCategoryIdWithCategory(Long categoryId);

    List<MenuItem> findByCategoryIdAndIsActiveTrueAndIsAvailableTrue(Long categoryId);

    List<MenuItem> findByIsActiveTrueAndIsAvailableTrue();

    @Query("""
        SELECT m FROM MenuItem m
        WHERE m.isActive = true AND m.isAvailable = true
        AND LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
    """)
    Page<MenuItem> searchByKeyword(String keyword, Pageable pageable);

    @Query("SELECT m FROM MenuItem m WHERE m.isActive = true ORDER BY m.totalSold DESC")
    List<MenuItem> findTopSellingItems(Pageable pageable);

    @Query("SELECT m FROM MenuItem m WHERE m.isActive = true ORDER BY m.avgRating DESC")
    List<MenuItem> findTopRatedItems(Pageable pageable);

    List<MenuItem> findByCategoryIdAndIsActiveTrue(Long categoryId);

    List<MenuItem> findByCategoryId(Long categoryId);

    List<MenuItem> findTop3ByOrderByTotalSoldDesc();

    List<MenuItem> findByPriceLessThan(double price);

    // 🔥 AI recommendation (JPQL)
    @Query("""
        SELECT m FROM MenuItem m
        WHERE m.isActive = true AND m.isAvailable = true
        ORDER BY (m.avgRating * 0.7 + m.totalSold * 0.3) DESC
    """)
    List<MenuItem> findRecommendedItems(Pageable pageable);

    // 🔥 AI recommendation xịn (native SQL)
    @Query(value = """
        SELECT * FROM menu_items
        WHERE is_active = true AND is_available = true
        ORDER BY (avg_rating * LOG(total_sold + 1)) DESC
        LIMIT 5
    """, nativeQuery = true)
    List<MenuItem> findTopRecommended();
}