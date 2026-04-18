package com.restaurant.repository;

import com.restaurant.entity.CallStaff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CallStaffRepository extends JpaRepository<CallStaff, Long> {
    List<CallStaff> findByTableIdAndIsResolvedFalseOrderByCreatedAtDesc(Long tableId);
    List<CallStaff> findByIsResolvedFalseOrderByCreatedAtAsc();
}
