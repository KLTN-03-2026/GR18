package com.restaurant.repository;

import com.restaurant.entity.CallStaff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CallStaffRepository extends JpaRepository<CallStaff, Long> {
    List<CallStaff> findByTableIdAndIsResolvedFalseOrderByCreatedAtDesc(Long tableId);

    @Query("""
            SELECT DISTINCT c FROM CallStaff c
            JOIN FETCH c.table
            WHERE c.isResolved = false
            ORDER BY c.createdAt ASC
            """)
    List<CallStaff> findPendingWithTableFetched();
}
